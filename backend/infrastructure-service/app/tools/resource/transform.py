"""
Transformations for API payloads and workbook entries.
"""

from typing import Any
from app.schemas.resource_schemas import ResourceCreate, SavedResource
from app.schemas.intent_schemas import WorkbookEntry, WorkbookStatus

def to_api_payload(resource: ResourceCreate) -> dict[str, Any]:
    """Converts validated ResourceCreate to the dict format expected by project-service API."""
    payload = {
        "project_id": resource.project_id,
        "type": resource.type.value,
        "name": resource.name,
        "provider": resource.provider,
        "region": resource.region,
        "env": resource.env,
        "state": resource.state,
        "depends_on": resource.depends_on,
        "config": resource.config,
    }
    if resource.iac_context:
        payload["iac_context"] = resource.iac_context
    if resource.tags:
        payload["tags"] = resource.tags
    return payload

def to_api_payloads(resources: list[ResourceCreate]) -> list[dict[str, Any]]:
    return [to_api_payload(r) for r in resources]

def to_workbook_entry(resource_type: str, name: str, order: int) -> WorkbookEntry:
    """Creates a workbook tracking entry."""
    return WorkbookEntry(
        order=order,
        type=resource_type,
        name=name,
        status=WorkbookStatus.PENDING
    )

def to_workbook(resources: list[ResourceCreate]) -> list[WorkbookEntry]:
    entries = []
    for i, res in enumerate(resources):
        entries.append(to_workbook_entry(res.type.value, res.name, i + 1))
    return entries

def to_saved_resource(api_result: dict[str, Any], resource: ResourceCreate, action: str = 'created') -> SavedResource:
    """Converts API response into a SavedResource model."""
    return SavedResource(
        id=api_result.get("id", ""),
        type=resource.type.value,
        name=resource.name,
        state=resource.state,
        action=action,
        config=resource.config,
        iac_context=resource.iac_context,
        provider=resource.provider,
        region=resource.region,
        env=resource.env,
        version=api_result.get("version", 1)
    )
