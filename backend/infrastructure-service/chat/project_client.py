"""
HTTP client for calling project-service REST APIs.

The infrastructure-service does NOT own the database — it delegates
all persistence to the project-service via these internal HTTP calls,
forwarding the user's JWT for authentication.
"""

import httpx
import logging
from typing import Optional

from config import settings

logger = logging.getLogger(__name__)


class ProjectServiceClient:
    """
    Async HTTP client for project-service (port 8002).
    All calls forward the user's JWT so project-service
    validates auth the same way it does for direct API calls.
    """

    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.PROJECT_SERVICE_URL).rstrip("/")

    # ── Infrastructure Resources ──────────────────────────────────────

    async def create_resource(self, resource_data: dict, auth_token: str) -> dict:
        """
        POST /api/infrastructure/resources
        Creates a new infra resource via the unified resource API.

        Args:
            resource_data: Dict matching InfraResourceCreate schema:
                {
                    "project_id": "...",
                    "type": "network|compute|serverless|database",
                    "name": "...",
                    "provider": "aws",
                    "region": "us-east-1",
                    "env": "dev",
                    "config": { ... },
                    "depends_on": ["resource_id", ...],
                    "state": "planned"
                }
            auth_token: User's JWT (forwarded as-is).

        Returns:
            Response dict from project-service.
        """
        url = f"{self.base_url}/api/infrastructure/resources"
        logger.info(f"Creating resource via project-service: {url}")
        logger.info(f"  type={resource_data.get('type')}, name={resource_data.get('name')}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json=resource_data,
                    headers={
                        "Authorization": f"Bearer {auth_token}",
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code == 201:
                data = response.json()
                logger.info(f"  ✅ Resource created: id={data.get('id')}")
                return data
            else:
                error_detail = response.text
                logger.error(f"  ❌ project-service returned {response.status_code}: {error_detail}")
                return {
                    "error": True,
                    "status_code": response.status_code,
                    "detail": error_detail,
                }

        except httpx.ConnectError:
            logger.error(f"  ❌ Cannot connect to project-service at {self.base_url}")
            return {"error": True, "detail": f"Cannot connect to project-service at {self.base_url}"}
        except httpx.TimeoutException:
            logger.error("  ❌ project-service request timed out")
            return {"error": True, "detail": "Project service request timed out"}
        except Exception as e:
            logger.error(f"  ❌ Unexpected error calling project-service: {e}")
            return {"error": True, "detail": str(e)}

    async def get_project_resources(self, project_id: str, auth_token: str) -> list:
        """
        GET /api/infrastructure/resources/project/{project_id}
        Fetch all existing resources for a project.
        """
        url = f"{self.base_url}/api/infrastructure/resources/project/{project_id}"
        logger.info(f"Fetching project resources: {url}")

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {auth_token}"},
                )

            if response.status_code == 200:
                resources = response.json()
                logger.info(f"  ✅ Found {len(resources)} existing resources")
                return resources
            else:
                logger.warning(f"  ⚠️ project-service returned {response.status_code}")
                return []

        except Exception as e:
            logger.warning(f"  ⚠️ Could not fetch project resources: {e}")
            return []

    async def get_project(self, project_id: str, auth_token: str) -> dict | None:
        """
        GET /api/projects/{project_id}
        Fetch project details (name, cloud_provider, region, etc.).
        """
        url = f"{self.base_url}/api/projects/{project_id}"
        logger.info(f"Fetching project info: {url}")

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {auth_token}"},
                )

            if response.status_code == 200:
                project = response.json()
                logger.info(f"  ✅ Project: {project.get('project_name')}")
                return project
            else:
                logger.warning(f"  ⚠️ project-service returned {response.status_code}")
                return None

        except Exception as e:
            logger.warning(f"  ⚠️ Could not fetch project info: {e}")
            return None

    async def update_resource(self, resource_id: str, update_data: dict, auth_token: str) -> dict:
        """
        PUT /api/infrastructure/resources/{resource_id}
        Update an existing resource's config/name/state.

        Args:
            resource_id: The ID of the resource to update.
            update_data: Dict matching InfraResourceUpdate schema:
                {
                    "config": { ... },
                    "name": "new-name",
                    "state": "planned",
                    "change_reason": "Updated via chat",
                    "changed_by": "system"
                }
            auth_token: User's JWT (forwarded as-is).
        """
        url = f"{self.base_url}/api/infrastructure/resources/{resource_id}"
        logger.info(f"Updating resource via project-service: {url}")

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.put(
                    url,
                    json=update_data,
                    headers={
                        "Authorization": f"Bearer {auth_token}",
                        "Content-Type": "application/json",
                    },
                )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"  ✅ Resource updated: id={data.get('id')}")
                return data
            else:
                error_detail = response.text
                logger.error(f"  ❌ project-service returned {response.status_code}: {error_detail}")
                return {
                    "error": True,
                    "status_code": response.status_code,
                    "detail": error_detail,
                }

        except httpx.ConnectError:
            logger.error(f"  ❌ Cannot connect to project-service at {self.base_url}")
            return {"error": True, "detail": f"Cannot connect to project-service at {self.base_url}"}
        except httpx.TimeoutException:
            logger.error("  ❌ project-service request timed out")
            return {"error": True, "detail": "Project service request timed out"}
        except Exception as e:
            logger.error(f"  ❌ Unexpected error calling project-service: {e}")
            return {"error": True, "detail": str(e)}

    async def save_provisioning_context(self, project_id: str, session_id: str, resources: list, auth_token: str) -> dict:
        """
        POST /api/projects/{project_id}/provision-context
        Save a snapshot of the confirmed infrastructure.
        """
        url = f"{self.base_url}/api/projects/{project_id}/provision-context"
        logger.info(f"Saving provisioning context: {url}")
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    url,
                    json={
                        "project_id": project_id,
                        "session_id": session_id,
                        "resources": resources,
                        "status": "confirmed"
                    },
                    headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
                )
            if response.status_code == 201:
                return response.json()
            return {"error": True, "detail": response.text}
        except Exception as e:
            return {"error": True, "detail": str(e)}

    async def get_latest_provisioning_context(self, project_id: str, auth_token: str) -> dict | None:
        """
        GET /api/projects/{project_id}/provision-context
        """
        url = f"{self.base_url}/api/projects/{project_id}/provision-context"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url, headers={"Authorization": f"Bearer {auth_token}"})
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None

    async def check_health(self) -> bool:
        """Ping project-service health endpoint."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/api/health")
            return response.status_code == 200
        except Exception:
            return False


# Singleton instance
project_client = ProjectServiceClient()
