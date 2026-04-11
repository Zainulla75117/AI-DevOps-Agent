import httpx
from typing import List, Dict, Any, Optional
from app.models.scm import SCM

async def fetch_gitlab_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from GitLab using PAT.
    Supports both gitlab.com and self-hosted GitLab instances.
    
    Args:
        scm: SCM credentials model (with optional base_url for self-hosted)
        
    Returns:
        List of repository dictionaries from GitLab API
    """
    try:
        # Determine GitLab base URL
        if scm.base_url:
            # Use self-hosted GitLab URL
            base_url = scm.base_url.rstrip('/')  # Remove trailing slash if present
            if not base_url.startswith('http://') and not base_url.startswith('https://'):
                base_url = f"https://{base_url}"  # Add https:// if protocol is missing
        else:
            # Default to gitlab.com
            base_url = "https://gitlab.com"
        
        # GitLab API endpoint for user's projects
        url = f"{base_url}/api/v4/projects"
        
        headers = {
            "PRIVATE-TOKEN": scm.pat
        }
        
        params = {
            "membership": True,  # Only projects user is a member of
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
                
                # Transform GitLab format to include all fields
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
                        "visibility": repo.get("visibility"),  # private, public, internal
                        "is_archived": repo.get("archived", False),
                        "is_fork": repo.get("forked_from_project") is not None,
                        "path": repo.get("path"),
                        "path_with_namespace": repo.get("path_with_namespace"),
                        "star_count": repo.get("star_count", 0),
                        "fork_count": 0,  # GitLab doesn't provide fork count directly
                        "repo_created_at": repo.get("created_at"),
                        "repo_updated_at": repo.get("last_activity_at"),  # GitLab uses last_activity_at
                        "last_activity_at": repo.get("last_activity_at")
                    })
                
                all_repos.extend(transformed_repos)
                
                # Check if there are more pages
                if len(repos) < params["per_page"]:
                    break
                params["page"] += 1
        
        return all_repos
    except Exception as e:
        print(f"❌ Error fetching GitLab repositories: {e}")
        raise

async def fetch_github_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from GitHub using PAT.
    Supports both github.com and GitHub Enterprise (self-hosted).
    
    Args:
        scm: SCM credentials model (with optional base_url for GitHub Enterprise)
        
    Returns:
        List of repository dictionaries from GitHub API
    """
    try:
        # Determine GitHub base URL
        if scm.base_url:
            # Use GitHub Enterprise URL
            base_url = scm.base_url.rstrip('/')
            if not base_url.startswith('http://') and not base_url.startswith('https://'):
                base_url = f"https://{base_url}"
            url = f"{base_url}/api/v3/user/repos"
        else:
            # Default to github.com
            url = "https://api.github.com/user/repos"
        
        headers = {
            "Authorization": f"token {scm.pat}",
            "Accept": "application/vnd.github.v3+json"
        }
        
        params = {
            "type": "all",  # all, owner, member
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
                
                all_repos.extend(repos)
                
                # Check if there are more pages
                if len(repos) < params["per_page"]:
                    break
                params["page"] += 1
        
        # Transform GitHub format to include all fields
        transformed_repos = []
        for repo in all_repos:
            # Determine visibility
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
                "last_activity_at": repo.get("pushed_at")  # GitHub uses pushed_at as last activity
            })
        
        return transformed_repos
    except Exception as e:
        print(f"❌ Error fetching GitHub repositories: {e}")
        raise

async def fetch_bitbucket_repositories(scm: SCM) -> List[Dict[str, Any]]:
    """
    Fetch repositories from Bitbucket using username and app password.
    Supports both bitbucket.org and Bitbucket Server (self-hosted).
    
    Args:
        scm: SCM credentials model (with optional base_url for Bitbucket Server)
        
    Returns:
        List of repository dictionaries from Bitbucket API
    """
    try:
        # Determine Bitbucket base URL
        if scm.base_url:
            # Use Bitbucket Server URL
            base_url = scm.base_url.rstrip('/')
            if not base_url.startswith('http://') and not base_url.startswith('https://'):
                base_url = f"https://{base_url}"
            url = f"{base_url}/rest/api/1.0/repos"
        else:
            # Default to bitbucket.org
            url = f"https://api.bitbucket.org/2.0/repositories/{scm.username}"
        
        auth = (scm.username, scm.pat)  # Bitbucket uses username:app_password for auth
        
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
                
                # Transform Bitbucket format to include all fields
                for repo in repos:
                    # Extract clone URLs
                    clone_links = repo.get("links", {}).get("clone", [])
                    http_url = None
                    ssh_url = None
                    for link in clone_links:
                        if link.get("name") == "https":
                            http_url = link.get("href")
                        elif link.get("name") == "ssh":
                            ssh_url = link.get("href")
                    
                    # Determine visibility
                    visibility = "private" if repo.get("is_private") else "public"
                    
                    # Extract UUID and convert to integer if possible
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
                        "is_archived": False,  # Bitbucket API doesn't provide archived status
                        "is_fork": repo.get("parent") is not None,
                        "path": repo.get("name"),
                        "path_with_namespace": repo.get("full_name"),
                        "star_count": 0,  # Bitbucket doesn't have stars
                        "fork_count": 0,  # Bitbucket doesn't provide fork count
                        "repo_created_at": repo.get("created_on"),
                        "repo_updated_at": repo.get("updated_on"),
                        "last_activity_at": repo.get("updated_on")
                    })
                
                # Check if there are more pages
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
    
    Args:
        scm: SCM credentials model
        
    Returns:
        List of repository dictionaries
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

