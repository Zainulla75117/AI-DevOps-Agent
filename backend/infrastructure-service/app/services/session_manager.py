"""
Session management for infrastructure-service.
"""
import time
import logging
from typing import Dict, Any

from config import settings
from postgres import conversation_store
from app.services.resource_service import resource_service
from app.auth import extract_user_id

logger = logging.getLogger(__name__)

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, Dict[str, Any]] = {}

    async def get_or_create(
        self,
        session_id: str,
        project_id: str,
        project_name: str,
        auth_token: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Get an existing session or create a new one."""
        if session_id not in self.sessions:
            user_id = extract_user_id(auth_token)

            conv_record = await conversation_store.get_conversation(session_id)
            if not conv_record:
                conv_record = await conversation_store.create_conversation(
                    project_id=project_id,
                    session_id=session_id,
                    user_id=user_id,
                    title="Initial Chat",
                )
                logger.info(f"Created new conversation record for session {session_id}")
            else:
                logger.info(f"Loaded existing conversation '{conv_record.get('title')}' for session {session_id}")

            project_memories = await conversation_store.get_project_memory(project_id)
            
            repo_scan_memory = None
            for mem in project_memories:
                if mem.get("memory_type") == "repo_scan":
                    repo_scan_memory = mem
                    break

            existing_resources = []
            try:
                existing_resources = await resource_service.get_project_resources(project_id, auth_token)
            except Exception as e:
                logger.warning(f"Could not fetch existing resources: {e}")

            project_info = {}
            try:
                url = f"{resource_service.base_url}/api/projects/{project_id}"
                resp = await resource_service.client.get(url, headers={"Authorization": f"Bearer {auth_token}"})
                if resp.status_code == 200:
                    project_info = resp.json()
            except Exception as e:
                logger.warning(f"Could not fetch project metadata: {e}")

            provisioning_context = None
            try:
                url = f"{resource_service.base_url}/api/projects/{project_id}/provision-context"
                resp = await resource_service.client.get(url, headers={"Authorization": f"Bearer {auth_token}"})
                if resp.status_code == 200:
                    provisioning_context = resp.json()
            except Exception as e:
                logger.warning(f"Could not fetch provisioning context: {e}")

            pg_summary = None
            try:
                from app.services.summary_service import summary_service
                pg_summary = await summary_service.get_latest_summary(project_id)
            except Exception as e:
                logger.warning(f"Could not fetch PostgreSQL summary: {e}")

            conv_summary = None
            if conv_record:
                conv_summary = await conversation_store.get_latest_conversation_summary(str(conv_record["id"]))

            infra_exists = bool(existing_resources or provisioning_context)

            self.sessions[session_id] = {
                "session_id": session_id,
                "project_id": project_id,
                "project_name": project_name,
                "project_info": project_info,
                "provisioning_context": provisioning_context,
                "pg_summary": pg_summary,
                "auth_token": auth_token,
                "user_id": user_id,
                "conversation_id": str(conv_record["id"]) if conv_record else None,
                "conversation_summary": conv_summary,
                "project_memories": project_memories,
                "repo_scan_memory": repo_scan_memory,
                "infra_exists": infra_exists,
                "messages": [],
                "intent": "general",
                "current_resource_type": None,
                "collected_fields": {},
                "missing_fields": [],
                "pending_resources": [],
                "saved_resources": [],
                "existing_resources": existing_resources,
                "dependency_asked": False,
                "created_at": time.time(),
                "_is_first_message": True,
            }
            
            repo_id = kwargs.get("repo_id")
            # ── DEBUG: Print repo tree fetch decision ──
            print("\n" + "-" * 70)
            print("🔍 [SESSION] Repo tree fetch decision:")
            print(f"   repo_id          = {repo_id}")
            print(f"   repo_scan_memory = {bool(repo_scan_memory)}")
            print(f"   infra_exists     = {infra_exists}")
            print(f"   existing_resources count = {len(existing_resources)}")
            print(f"   provisioning_context     = {bool(provisioning_context)}")
            will_fetch = bool(repo_id and not repo_scan_memory and not infra_exists)
            print(f"   ➡️  Will fetch repo tree: {will_fetch}")
            print("-" * 70 + "\n")

            if repo_id and not repo_scan_memory and not infra_exists:
                try:
                    import httpx
                    scm_url = f"{settings.SCM_SERVICE_URL}/api/scm/repos/{repo_id}/tree"
                    logger.info(f"Fetching repo tree from {scm_url}...")
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.get(scm_url, headers={"Authorization": f"Bearer {auth_token}"})
                        if resp.status_code == 200:
                            tree_data = resp.json()
                            logger.info(f"Successfully fetched repo tree: {len(tree_data.get('tree', []))} files, {len(tree_data.get('dependency_files', {}))} deps")
                            self.sessions[session_id]["repo_tree"] = tree_data
                        else:
                            logger.error(f"Failed to fetch repo tree. Status: {resp.status_code}, Body: {resp.text}")
                except Exception as e:
                    logger.error(f"Exception while fetching repo tree: {e}", exc_info=True)

        else:
            self.sessions[session_id]["auth_token"] = auth_token

            try:
                existing_resources = await resource_service.get_project_resources(project_id, auth_token)
                self.sessions[session_id]["existing_resources"] = existing_resources
            except Exception as e:
                existing_resources = self.sessions[session_id].get("existing_resources", [])

            try:
                url = f"{resource_service.base_url}/api/projects/{project_id}/provision-context"
                resp = await resource_service.client.get(url, headers={"Authorization": f"Bearer {auth_token}"})
                prov_ctx = resp.json() if resp.status_code == 200 else None
                self.sessions[session_id]["provisioning_context"] = prov_ctx
            except Exception as e:
                prov_ctx = self.sessions[session_id].get("provisioning_context")

            try:
                from app.services.summary_service import summary_service
                pg_summary = await summary_service.get_latest_summary(project_id)
                self.sessions[session_id]["pg_summary"] = pg_summary
            except Exception as e:
                pg_summary = self.sessions[session_id].get("pg_summary")

            try:
                project_memories = await conversation_store.get_project_memory(project_id)
                self.sessions[session_id]["project_memories"] = project_memories
                repo_scan_memory = None
                for mem in project_memories:
                    if mem.get("memory_type") == "repo_scan":
                        repo_scan_memory = mem
                        break
                self.sessions[session_id]["repo_scan_memory"] = repo_scan_memory
            except Exception as e:
                pass

            old_infra_exists = self.sessions[session_id].get("infra_exists", False)
            new_infra_exists = bool(existing_resources or prov_ctx)
            self.sessions[session_id]["infra_exists"] = new_infra_exists

            if old_infra_exists and not new_infra_exists:
                self.sessions[session_id]["saved_resources"] = []
                self.sessions[session_id]["pending_resources"] = []
                self.sessions[session_id]["collected_fields"] = {}
                self.sessions[session_id]["current_resource_type"] = None
                self.sessions[session_id]["missing_fields"] = []
                self.sessions[session_id]["intent"] = "general"
                self.sessions[session_id]["dependency_asked"] = False
                self.sessions[session_id]["messages"] = []

        return self.sessions[session_id]

    async def refresh_session(self, session_id: str, auth_token: str) -> Dict[str, Any]:
        """Refreshes a session by calling get_or_create on an existing one."""
        if session_id in self.sessions:
            proj_id = self.sessions[session_id]["project_id"]
            proj_name = self.sessions[session_id]["project_name"]
            return await self.get_or_create(session_id, proj_id, proj_name, auth_token)
        return {}

    def purge_project_sessions(self, project_id: str) -> int:
        """Removes all sessions belonging to a project."""
        to_delete = [sid for sid, s in self.sessions.items() if s.get("project_id") == project_id]
        for sid in to_delete:
            del self.sessions[sid]
        return len(to_delete)

session_manager = SessionManager()
