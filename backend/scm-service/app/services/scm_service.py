import httpx
from typing import List, Dict, Any, Optional
import os
import io
import zipfile
import shutil
import base64
from app.models.scm import SCM

async def fetch_gitlab_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from GitLab using PAT.
    Supports both gitlab.com and self-hosted GitLab instances.
    """
    try:
        # Determine GitLab base URL
        if scm.base_url:
            base_url = scm.base_url.rstrip('/')
            if not base_url.startswith('http://') and not base_url.startswith('https://'):
                base_url = f"https://{base_url}"
        else:
            base_url = "https://gitlab.com"
        
        url = f"{base_url}/api/v4/projects"
        
        headers = {
            "PRIVATE-TOKEN": scm.pat
        }
        
        params = {
            "membership": True,
            "per_page": 100,
            "page": 1
        }
        
        all_repos = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                
                repos = response.json()
                if not repos:
                    break
                
                transformed_repos = []
                for repo in repos:
                    transformed_repos.append({
                        "id": repo.get("id"),
                        "description": repo.get("description"),
                        "name": repo.get("name", ""),
                        "name_with_namespace": repo.get("name_with_namespace", repo.get("path_with_namespace", "")),
                        "default_branch": repo.get("default_branch"),
                        "http_url_to_repo": repo.get("http_url_to_repo", ""),
                        "web_url": repo.get("web_url"),
                        "ssh_url_to_repo": repo.get("ssh_url_to_repo"),
                        "visibility": repo.get("visibility"),
                        "is_archived": repo.get("archived", False),
                        "is_fork": repo.get("forked_from_project") is not None,
                        "path": repo.get("path"),
                        "path_with_namespace": repo.get("path_with_namespace"),
                        "star_count": repo.get("star_count", 0),
                        "fork_count": 0,
                        "repo_created_at": repo.get("created_at"),
                        "repo_updated_at": repo.get("last_activity_at"),
                        "last_activity_at": repo.get("last_activity_at")
                    })
                
                all_repos.extend(transformed_repos)
                
                if len(repos) < params["per_page"]:
                    break
                params["page"] += 1
        
        return all_repos
    except Exception as e:
        print(f"❌ Error fetching GitLab repositories: {e}")
        raise

import time
from jose import jwt

def get_github_app_jwt() -> str:
    """Generate a JWT for the GitHub App."""
    from app.config import settings
    private_key = settings.GITHUB_APP_PRIVATE_KEY.replace('\\n', '\n')
    if not private_key or not settings.GITHUB_APP_ID:
        raise ValueError("GitHub App credentials are not fully configured in .env")
        
    now = int(time.time())
    payload = {
        "iat": now - 60,
        "exp": now + (10 * 60),
        "iss": settings.GITHUB_APP_ID
    }
    return jwt.encode(payload, private_key, algorithm="RS256")

async def get_installation_token(installation_id: str) -> str:
    """Exchange GitHub App JWT for an installation access token."""
    app_jwt = get_github_app_jwt()
    headers = {
        "Authorization": f"Bearer {app_jwt}",
        "Accept": "application/vnd.github.v3+json"
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"https://api.github.com/app/installations/{installation_id}/access_tokens",
            headers=headers
        )
        if resp.status_code != 201:
            print(f"❌ Failed to get installation token: {resp.text}")
            resp.raise_for_status()
        return resp.json()["token"]

async def fetch_github_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from GitHub using PAT, OAuth token, or GitHub App Installation token.
    Supports both github.com and GitHub Enterprise (self-hosted).
    """
    try:
        # Determine auth header based on auth_type
        auth_type = getattr(scm, 'auth_type', 'pat')
        
        # Determine the API endpoint URL for fetching repos
        if auth_type == "github_app" and getattr(scm, 'installation_id', None):
            # GitHub Apps use a specific endpoint that returns only the repos the user granted access to
            url = "https://api.github.com/installation/repositories"
            # Generate a fresh installation token
            token = await get_installation_token(scm.installation_id)
            auth_header = f"Bearer {token}"
        else:
            # Standard OAuth or PAT
            if scm.base_url:
                base_url = scm.base_url.rstrip('/')
                if not base_url.startswith('http://') and not base_url.startswith('https://'):
                    base_url = f"https://{base_url}"
                url = f"{base_url}/api/v3/user/repos"
            else:
                url = "https://api.github.com/user/repos"
            
            if auth_type == "oauth" and getattr(scm, 'oauth_access_token', None):
                auth_header = f"Bearer {scm.oauth_access_token}"
            else:
                auth_header = f"token {scm.pat}"
        
        headers = {
            "Authorization": auth_header,
            "Accept": "application/vnd.github.v3+json"
        }
        
        params = {
            "per_page": 100,
            "page": 1
        }
        if auth_type != "github_app":
            params["type"] = "all"
        
        all_repos = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()
                
                data = response.json()
                
                # GitHub App /installation/repositories returns a different payload structure
                if auth_type == "github_app":
                    repos = data.get("repositories", [])
                    total_count = data.get("total_count", 0)
                else:
                    repos = data
                
                if not repos:
                    break
                
                all_repos.extend(repos)
                
                if len(repos) < params["per_page"]:
                    break
                params["page"] += 1
        
        transformed_repos = []
        for repo in all_repos:
            visibility = "private" if repo.get("private") else "public"
            
            transformed_repos.append({
                "id": repo.get("id"),
                "description": repo.get("description"),
                "name": repo.get("name", ""),
                "name_with_namespace": repo.get("full_name", repo.get("name", "")),
                "default_branch": repo.get("default_branch"),
                "http_url_to_repo": repo.get("clone_url", ""),
                "web_url": repo.get("html_url"),
                "ssh_url_to_repo": repo.get("ssh_url"),
                "visibility": visibility,
                "is_archived": repo.get("archived", False),
                "is_fork": repo.get("fork", False),
                "path": repo.get("name"),
                "path_with_namespace": repo.get("full_name"),
                "star_count": repo.get("stargazers_count", 0),
                "fork_count": repo.get("forks_count", 0),
                "repo_created_at": repo.get("created_at"),
                "repo_updated_at": repo.get("updated_at"),
                "last_activity_at": repo.get("pushed_at")
            })
        
        return transformed_repos
    except Exception as e:
        print(f"❌ Error fetching GitHub repositories: {e}")
        raise

async def fetch_bitbucket_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from Bitbucket using username and app password.
    Supports both bitbucket.org and Bitbucket Server (self-hosted).
    """
    try:
        if scm.base_url:
            base_url = scm.base_url.rstrip('/')
            if not base_url.startswith('http://') and not base_url.startswith('https://'):
                base_url = f"https://{base_url}"
            url = f"{base_url}/rest/api/1.0/repos"
        else:
            url = f"https://api.bitbucket.org/2.0/repositories/{scm.username}"
        
        auth = (scm.username, scm.pat)
        
        params = {
            "pagelen": 100,
            "page": 1
        }
        
        all_repos = []
        async with httpx.AsyncClient(timeout=30.0) as client:
            while True:
                response = await client.get(url, auth=auth, params=params)
                response.raise_for_status()
                
                data = response.json()
                repos = data.get("values", [])
                
                if not repos:
                    break
                
                for repo in repos:
                    clone_links = repo.get("links", {}).get("clone", [])
                    http_url = None
                    ssh_url = None
                    for link in clone_links:
                        if link.get("name") == "https":
                            http_url = link.get("href")
                        elif link.get("name") == "ssh":
                            ssh_url = link.get("href")
                    
                    visibility = "private" if repo.get("is_private") else "public"
                    
                    uuid_str = repo.get("uuid", "").replace("{", "").replace("}", "")
                    try:
                        repo_id = int(uuid_str.replace("-", "")[:8], 16) if uuid_str else 0
                    except:
                        repo_id = hash(uuid_str) if uuid_str else 0
                    
                    all_repos.append({
                        "id": repo_id,
                        "description": repo.get("description"),
                        "name": repo.get("name", ""),
                        "name_with_namespace": repo.get("full_name", repo.get("name", "")),
                        "default_branch": repo.get("mainbranch", {}).get("name") if repo.get("mainbranch") else None,
                        "http_url_to_repo": http_url or "",
                        "web_url": repo.get("links", {}).get("html", {}).get("href"),
                        "ssh_url_to_repo": ssh_url,
                        "visibility": visibility,
                        "is_archived": False,
                        "is_fork": repo.get("parent") is not None,
                        "path": repo.get("name"),
                        "path_with_namespace": repo.get("full_name"),
                        "star_count": 0,
                        "fork_count": 0,
                        "repo_created_at": repo.get("created_on"),
                        "repo_updated_at": repo.get("updated_on"),
                        "last_activity_at": repo.get("updated_on")
                    })
                
                if not data.get("next"):
                    break
                params["page"] += 1
        
        return all_repos
    except Exception as e:
        print(f"❌ Error fetching Bitbucket repositories: {e}")
        raise

async def fetch_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from SCM provider based on scm_name.
    """
    scm_name_lower = scm.scm_name.lower()
    
    if scm_name_lower == "gitlab":
        return await fetch_gitlab_repositories(scm)
    elif scm_name_lower == "github":
        return await fetch_github_repositories(scm)
    elif scm_name_lower == "bitbucket":
        return await fetch_bitbucket_repositories(scm)
    else:
        raise ValueError(f"Unsupported SCM provider: {scm.scm_name}")

async def download_and_extract_repo_zip(scm: SCM, repo_details: Dict[str, Any]) -> str:
    """
    Downloads the repository as a ZIP archive and extracts it to a local data directory.
    Returns the path to the extracted directory.
    """
    scm_name_lower = scm.scm_name.lower()
    repo_id = str(repo_details.get("id", ""))
    repo_full_name = repo_details.get("name_with_namespace", "")
    default_branch = repo_details.get("default_branch") or "main"
    
    # Base directory for extracted repos
    base_repos_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "data", "repos"))
    os.makedirs(base_repos_dir, exist_ok=True)
    
    safe_repo_name = repo_full_name.replace("/", "_").replace("\\", "_")
    target_dir = os.path.join(base_repos_dir, f"{repo_id}_{safe_repo_name}")
    
    # If already downloaded, we could skip. But since it's a sync, we redownload.
    shutil.rmtree(target_dir, ignore_errors=True)
    os.makedirs(target_dir, exist_ok=True)
    
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        if scm_name_lower == "github":
            auth_type = getattr(scm, 'auth_type', 'pat')
            if auth_type == "github_app" and getattr(scm, 'installation_id', None):
                token = await get_installation_token(scm.installation_id)
                auth_header = f"Bearer {token}"
            elif auth_type == "oauth" and getattr(scm, 'oauth_access_token', None):
                auth_header = f"Bearer {scm.oauth_access_token}"
            else:
                auth_header = f"token {scm.pat}"
                
            headers = {"Authorization": auth_header}
            if scm.base_url:
                base_url = scm.base_url.rstrip('/')
                url = f"{base_url}/api/v3/repos/{repo_full_name}/zipball/{default_branch}"
            else:
                url = f"https://api.github.com/repos/{repo_full_name}/zipball/{default_branch}"
                
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            zip_data = resp.content
            
        elif scm_name_lower == "gitlab":
            if scm.base_url:
                base_url = scm.base_url.rstrip('/')
            else:
                base_url = "https://gitlab.com"
                
            headers = {"PRIVATE-TOKEN": scm.pat}
            url = f"{base_url}/api/v4/projects/{repo_id}/repository/archive.zip?sha={default_branch}"
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            zip_data = resp.content
            
        elif scm_name_lower == "bitbucket":
            auth = (scm.username, scm.pat)
            url = f"https://bitbucket.org/{repo_full_name}/get/{default_branch}.zip"
            resp = await client.get(url, auth=auth)
            resp.raise_for_status()
            zip_data = resp.content
        else:
            raise ValueError(f"Unsupported SCM provider for zip download: {scm_name_lower}")
            
        # Extract the ZIP
        with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
            zf.extractall(target_dir)
            
        return target_dir

async def fetch_repository_tree(scm: SCM, repo_details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Reads the local file tree of the repository and the content of key dependency files.
    Filters out large directories like node_modules, venv, etc.
    """
    repo_id = str(repo_details.get("id", ""))
    repo_full_name = repo_details.get("name_with_namespace", "")
    safe_repo_name = repo_full_name.replace("/", "_").replace("\\", "_")
    base_repos_dir = os.path.abspath(os.path.join(os.getcwd(), "..", "data", "repos"))
    target_dir = os.path.join(base_repos_dir, f"{repo_id}_{safe_repo_name}")
    
    # If not local yet, sync it
    if not os.path.exists(target_dir):
        await download_and_extract_repo_zip(scm, repo_details)
        
    tree = []
    dependency_files = {}
    
    EXCLUDED_DIRS = {"node_modules", "venv", ".venv", "dist", "build", ".git", ".idea", "__pycache__"}
    
    # Expanded to only inject dependency and infrastructure related files as requested
    DEPENDENCY_FILES_TO_FETCH = {
        "package.json", "requirements.txt", "pom.xml", "build.gradle", "go.mod",
        "Dockerfile", "docker-compose.yml", "Jenkinsfile", "Makefile",
        "sonar-project.properties", ".env.example", ".env.template"
    }
    
    # Find the actual root inside the extracted zip (GitHub zips have a top-level dir)
    actual_root = target_dir
    items = os.listdir(target_dir)
    if len(items) == 1 and os.path.isdir(os.path.join(target_dir, items[0])):
        actual_root = os.path.join(target_dir, items[0])

    for root, dirs, files in os.walk(actual_root):
        # Mutate dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        
        rel_root = os.path.relpath(root, actual_root)
        if rel_root == ".":
            rel_root = ""
            
        for name in files:
            file_path = os.path.join(rel_root, name) if rel_root else name
            # Replace backslashes with forward slashes for standard tree representation
            file_path = file_path.replace("\\", "/")
            tree.append(file_path)
            
            # Match strict filenames or extensions for .tf
            is_dependency = name in DEPENDENCY_FILES_TO_FETCH or name.endswith(".tf")
            
            if is_dependency:
                abs_path = os.path.join(root, name)
                try:
                    with open(abs_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        # Truncate content if a single file is too large (e.g. huge package-lock)
                        if len(content) > 50000:
                            content = content[:50000] + "... (truncated)"
                        dependency_files[file_path] = content
                except Exception as e:
                    print(f"Skipping binary or unreadable dependency file {file_path}: {e}")

    return {
        "tree": tree,
        "dependency_files": dependency_files
    }
