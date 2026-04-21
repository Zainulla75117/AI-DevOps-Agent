import httpx
import logging
import os

logger = logging.getLogger(__name__)

class ProjectServiceClient:
    """
    Async HTTP client for project-service (port 8000 API Gateway routes to 8002).
    """

    def __init__(self):
        # We default to the Gateway URL since Jenkins service talks via the gateway
        self.base_url = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")

    async def get_project(self, project_id: str, auth_token: str) -> dict | None:
        """
        GET /api/projects/{project_id}
        Fetch project details (name, domain, environment, expectedTraffic, etc.).
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
                logger.info(f"  ✅ Project info fetched: {project.get('project_name')}")
                return project
            else:
                logger.warning(f"  ⚠️ project_client return {response.status_code}: {response.text}")
                return None

        except Exception as e:
            logger.warning(f"  ⚠️ Could not fetch project info: {e}")
            return None

project_client = ProjectServiceClient()
