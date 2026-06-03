"""
Node 5: Execute the approved infrastructure plan.

Creates resources sequentially in dependency order via the project-service API.
After resource creation, persists:
  - Provisioning context (resource → session mapping)
  - Infrastructure summary (PostgreSQL for querying)
  - IaC blueprint (project memory for future context)
"""

import logging
from chat.project_client import project_client

logger = logging.getLogger(__name__)


async def execute_dag_plan(state: dict) -> dict:
    """
    Execute the approved plan based on DAG dependency order.

    Resources are created sequentially. On first failure, execution stops
    to prevent dependent resources from failing in cascade.

    Post-save side effects:
      1. Save provisioning context to project-service
      2. Persist infrastructure summary to PostgreSQL
      3. Save IaC blueprint to project memory
    """
    logger.info("Running execute_dag_plan node...")

    intent = state.get("intent")
    if intent != "approve_plan":
        return state

    plan_dict = state.get("generated_plan")
    approved_orders = state.get("approved_orders", [])

    if not plan_dict or not plan_dict.get("resources"):
        return {
            **state,
            "response_content": "No plan to execute.",
            "response_type": "text",
        }

    resources = plan_dict["resources"]
    auth_token = state.get("auth_token", "")
    project_id = state.get("project_id", "")
    project_name = state.get("project_name", "Unknown")
    session_id = state.get("session_id", "")

    # Filter to approved resources, sorted by dependency order
    to_execute = [r for r in resources if r.get("order") in approved_orders]
    to_execute.sort(key=lambda r: r.get("order", 0))

    results = []
    errors = []
    saved_resources = list(state.get("saved_resources", []))
    workbook = list(state.get("workbook", []))

    for res in to_execute:
        plan_order = res.get("order")

        # Update workbook: mark as creating
        if plan_order:
            for wb in workbook:
                if wb.get("order") == plan_order:
                    wb["status"] = "creating"

        try:
            payload = {
                "project_id": project_id,
                "type": res["type"],
                "name": res["name"],
                "provider": "aws",
                "state": "planned",
                "depends_on": [str(d) for d in res.get("depends_on", [])],
                "config": res.get("config", {}),
            }

            logger.info(f"Creating resource: {res['type']} / {res['name']}")
            result = await project_client.create_resource(payload, auth_token)

            if result.get("error"):
                error_msg = result.get("detail", "Unknown error")
                errors.append(f"Failed to create {res['name']}: {error_msg}")
                if plan_order:
                    for wb in workbook:
                        if wb.get("order") == plan_order:
                            wb["status"] = "failed"
                            wb["error"] = error_msg
                # Stop on failure to prevent dependent resources from failing
                break

            resource_id = result.get("id", "?")
            saved_item = {
                "id": resource_id,
                "type": res["type"],
                "name": res["name"],
                "state": "planned",
                "action": "created",
                "config": payload.get("config", {}),
            }
            saved_resources.append(saved_item)
            results.append(f"✅ Created {res['name']} ({res['type']})")

            if plan_order:
                for wb in workbook:
                    if wb.get("order") == plan_order:
                        wb["status"] = "created"
                        wb["resource_id"] = str(resource_id)

        except Exception as e:
            errors.append(f"Exception creating {res['name']}: {e}")
            if plan_order:
                for wb in workbook:
                    if wb.get("order") == plan_order:
                        wb["status"] = "failed"
                        wb["error"] = str(e)
            break

    # ── Post-save: Persist provisioning context ──
    if saved_resources:
        try:
            await project_client.save_provisioning_context(
                project_id=project_id,
                session_id=session_id,
                resources=saved_resources,
                auth_token=auth_token,
            )
            logger.info(f"Saved provisioning context for {len(saved_resources)} resources")
        except Exception as e:
            logger.warning(f"Failed to save provisioning context: {e}")

    # ── Post-save: Persist infrastructure summary to PostgreSQL ──
    if saved_resources:
        try:
            from postgres.summary_store import save_summary
            from postgres.connection import is_pg_available

            if is_pg_available():
                resource_lines = [
                    f"- {r['type'].capitalize()} '{r['name']}' was created"
                    for r in saved_resources
                ]
                llm_summary = (
                    f"Infrastructure plan executed for project '{project_name}'.\n"
                    f"Resources provisioned:\n" + "\n".join(resource_lines) + "\n"
                    f"Total resources: {len(saved_resources)}"
                )
                decisions = [f"Created {r['type']} '{r['name']}'" for r in saved_resources]
                await save_summary(
                    project_id=project_id,
                    user_id=None,
                    session_id=session_id,
                    plan_text=plan_dict.get("summary", ""),
                    decisions=decisions,
                    resources=saved_resources,
                    architecture={},
                    llm_summary=llm_summary,
                )
                logger.info(f"Saved infrastructure summary for project {project_id}")
        except Exception as e:
            logger.warning(f"Failed to save infrastructure summary: {e}")

    # ── Post-save: Persist IaC blueprint to project memory ──
    if saved_resources:
        try:
            from postgres.conversation_store import upsert_project_memory
            from postgres.connection import is_pg_available

            if is_pg_available():
                await upsert_project_memory(
                    project_id=project_id,
                    memory_type="iac_blueprint",
                    content=f"IaC blueprint with {len(saved_resources)} resources",
                    structured_data={
                        "resources": [
                            {
                                "type": r.get("type"),
                                "name": r.get("name"),
                                "full_config": r.get("config", {}),
                                "iac_context": r.get("iac_context", {}),
                            }
                            for r in saved_resources
                        ],
                        "session_id": session_id,
                    },
                    source_conversation_id=session_id,
                )
                logger.info(f"Saved IaC blueprint to project memory for {project_id}")
        except Exception as e:
            logger.warning(f"Failed to save IaC blueprint: {e}")

    # ── Build response ──
    created_count = sum(1 for wb in workbook if wb.get("status") == "created")
    failed_count = sum(1 for wb in workbook if wb.get("status") == "failed")
    total = len(workbook) if workbook else len(to_execute)

    if errors:
        response = (
            f"Provisioned {created_count}/{total} resources. {failed_count} failed.\n\n"
            + "\n".join(f"- {r}" for r in results)
        )
        if errors:
            response += "\n\nErrors:\n" + "\n".join(f"- {e}" for e in errors)
    else:
        response = (
            f"All {created_count} resources have been provisioned successfully!\n\n"
            + "\n".join(f"- {r}" for r in results)
        )

    return {
        **state,
        "pending_resources": [],
        "saved_resources": saved_resources,
        "collected_fields": {},
        "current_resource_type": None,
        "missing_fields": [],
        "dependency_asked": False,
        "intent": "general",
        "plan_status": "completed",
        "workbook": workbook,
        "response_content": response,
        "raw_response": response,
        "response_type": "plan_executed",
    }
