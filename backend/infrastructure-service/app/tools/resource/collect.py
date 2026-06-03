"""
Collection and normalization of infrastructure resources.
Normalizes raw LLM-extracted fields into validated ResourceCreate models.
"""

from typing import Any, Optional
from app.schemas.resource_schemas import ResourceCreate, ResourceType
from app.schemas.intent_schemas import PlanResource, ResourcePlan

def collect_resource_schema(
    resource_type: str, 
    raw_fields: dict[str, Any], 
    project_id: str, 
    project_info: Optional[dict[str, Any]] = None
) -> ResourceCreate:
    """
    Normalizes raw LLM-extracted fields into a validated ResourceCreate model.
    Maps field names, applies defaults from project_info, validates via the Pydantic config model.
    """
    try:
        r_type = ResourceType(resource_type.lower())
    except ValueError:
        r_type = ResourceType.NETWORK # fallback
        
    name = raw_fields.pop("name", f"{resource_type}-resource")
    
    resource = ResourceCreate(
        project_id=project_id,
        type=r_type,
        name=name,
        config=raw_fields
    )
    
    return resource

def collect_from_plan(
    plan: ResourcePlan, 
    approved_orders: list[int], 
    project_id: str, 
    project_info: Optional[dict[str, Any]] = None
) -> list[ResourceCreate]:
    """
    Converts approved plan resources into validated ResourceCreate objects.
    """
    resources = []
    for res in plan.resources:
        if res.order in approved_orders:
            try:
                r_type = ResourceType(res.type.lower())
            except ValueError:
                continue
                
            collected = ResourceCreate(
                project_id=project_id,
                type=r_type,
                name=res.name,
                config=res.config,
                depends_on=[str(o) for o in res.depends_on],
                iac_context={"rationale": res.rationale}
            )
            resources.append(collected)
            
    return resources
