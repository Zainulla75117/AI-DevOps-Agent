"""
Infrastructure summary persistence via postgres/summary_store.py
"""
import logging
from typing import Any, Optional
from postgres.summary_store import save_summary, get_latest_summary
from postgres.conversation_store import upsert_project_memory

logger = logging.getLogger(__name__)

class SummaryService:
    async def persist_infra_summary(
        self, project_id: str, session_id: str, saved_resources: list[dict[str, Any]], project_name: str, plan_text: str = ""
    ) -> None:
        try:
            resource_lines = [
                f"- {r.get('type', '').capitalize()} '{r.get('name', '')}' was created"
                for r in saved_resources
            ]
            llm_summary = (
                f"Infrastructure plan executed for project '{project_name}'.\n"
                f"Resources provisioned:\n" + "\n".join(resource_lines) + "\n"
                f"Total resources: {len(saved_resources)}"
            )
            decisions = [f"Created {r.get('type')} '{r.get('name')}'" for r in saved_resources]
            
            await save_summary(
                project_id=project_id,
                user_id=None,
                session_id=session_id,
                plan_text=plan_text,
                decisions=decisions,
                resources=saved_resources,
                architecture={},
                llm_summary=llm_summary,
            )
        except Exception as e:
            logger.warning(f"Failed to persist infra summary: {e}")

    async def persist_iac_blueprint(self, project_id: str, resources: list[dict[str, Any]], session_id: str) -> None:
        try:
            await upsert_project_memory(
                project_id=project_id,
                memory_type="iac_blueprint",
                content=f"IaC blueprint with {len(resources)} resources",
                structured_data={
                    "resources": [
                        {
                            "type": r.get("type"),
                            "name": r.get("name"),
                            "full_config": r.get("config", {}),
                            "iac_context": r.get("iac_context", {}),
                        }
                        for r in resources
                    ],
                    "session_id": session_id,
                },
                source_conversation_id=session_id,
            )
        except Exception as e:
            logger.warning(f"Failed to persist IaC blueprint: {e}")

    async def get_latest_summary(self, project_id: str) -> Optional[dict[str, Any]]:
        return await get_latest_summary(project_id)

summary_service = SummaryService()
