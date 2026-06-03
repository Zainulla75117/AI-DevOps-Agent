"""
Resource CRUD via project-service API.
Uses a persistent HTTP client.
"""

import httpx
import logging
from typing import Optional, Any
from config import settings

logger = logging.getLogger(__name__)

class ResourceService:
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.PROJECT_SERVICE_URL).rstrip("/")
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self):
        await self.client.aclose()

    async def create_resource(self, resource: dict[str, Any], auth_token: str) -> dict[str, Any]:
        """POST /api/infrastructure/resources"""
        url = f"{self.base_url}/api/infrastructure/resources"
        try:
            response = await self.client.post(
                url,
                json=resource,
                headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
            )
            if response.status_code == 201:
                return response.json()
            return {"error": True, "detail": response.text}
        except Exception as e:
            return {"error": True, "detail": str(e)}

    async def update_resource(self, resource_id: str, changes: dict[str, Any], auth_token: str) -> dict[str, Any]:
        """PUT /api/infrastructure/resources/{resource_id}"""
        url = f"{self.base_url}/api/infrastructure/resources/{resource_id}"
        try:
            response = await self.client.put(
                url,
                json=changes,
                headers={"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
            )
            if response.status_code == 200:
                return response.json()
            return {"error": True, "detail": response.text}
        except Exception as e:
            return {"error": True, "detail": str(e)}

    async def get_project_resources(self, project_id: str, auth_token: str) -> list[dict[str, Any]]:
        """GET /api/infrastructure/resources/project/{project_id}"""
        url = f"{self.base_url}/api/infrastructure/resources/project/{project_id}"
        try:
            response = await self.client.get(
                url, headers={"Authorization": f"Bearer {auth_token}"}
            )
            if response.status_code == 200:
                return response.json()
            return []
        except Exception:
            return []

    async def save_provisioning_context(
        self, project_id: str, session_id: str, resources: list[dict[str, Any]], auth_token: str
    ) -> dict[str, Any]:
        """POST /api/projects/{project_id}/provision-context"""
        url = f"{self.base_url}/api/projects/{project_id}/provision-context"
        try:
            response = await self.client.post(
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

resource_service = ResourceService()
