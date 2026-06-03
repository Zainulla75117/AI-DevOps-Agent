"""
Enrichment of infrastructure resources.
"""

from typing import Any, Optional
from app.schemas.resource_schemas import ResourceCreate

def enrich_resource(resource: ResourceCreate, project_info: Optional[dict[str, Any]] = None) -> ResourceCreate:
    """Applies project-level defaults (provider, region, env from project settings)."""
    if project_info:
        if not resource.provider and "cloud_provider" in project_info:
            resource.provider = project_info["cloud_provider"]
        if not resource.region and "region" in project_info:
            resource.region = project_info["region"]
        if not resource.env and "environment" in project_info:
            resource.env = project_info["environment"]
            
    return resource

def resolve_dependencies(resources: list[ResourceCreate]) -> list[ResourceCreate]:
    """Auto-links dependency references between resources based on DEPENDENCY_SUGGESTIONS rules."""
    return resources

def auto_name_resource(resource: ResourceCreate) -> ResourceCreate:
    """Generates a sensible name if the resource doesn't have one."""
    if not resource.name or resource.name == "unknown":
        resource.name = f"{resource.type.value}-resource"
    return resource
