"""
Unified CRUD operations for the infra_resources, infra_versions,
and infra_executions collections.

Design principles:
  - Every create/update to a resource automatically writes a version snapshot.
  - Deletes check the dependency graph before proceeding.
  - All queries use project_id (ObjectId), never project_name.
"""

from typing import List, Optional, Dict, Any
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
import uuid

from app.models.infra_resource import InfraResource
from app.models.infra_version import InfraVersion
from app.models.infra_execution import InfraExecution
from app.schemas.infra_resource import (
    InfraResourceCreate,
    InfraResourceUpdate,
    InfraExecutionCreate,
    InfraExecutionUpdate,
)


# ═══════════════════════════════════════════════════════════════════════
#  INFRA RESOURCES — CRUD
# ═══════════════════════════════════════════════════════════════════════

async def create_resource(
    db: AsyncIOMotorDatabase,
    data: InfraResourceCreate,
    changed_by: str = "system",
) -> InfraResource:
    """
    Insert a new resource into `infra_resources` and create version 1
    in `infra_versions`.
    """
    now = datetime.utcnow()
    doc = {
        "project_id": ObjectId(data.project_id) if data.project_id else None,
        "type": data.type,
        "name": data.name,
        "provider": data.provider,
        "region": data.region,
        "env": data.env,
        "config": data.config,
        "actual_state": None,
        "state": data.state,
        "version": 1,
        "depends_on": [ObjectId(dep) for dep in data.depends_on] if data.depends_on else [],
        "created_at": now,
        "updated_at": now,
        "last_applied_at": None,
        "last_applied_by": None,
    }

    result = await db.infra_resources.insert_one(doc)
    resource_id = result.inserted_id

    # Create version 1 snapshot
    version_doc = {
        "resource_id": resource_id,
        "version": 1,
        "config": data.config,
        "changed_by": changed_by,
        "change_reason": "Initial creation",
        "created_at": now,
    }
    await db.infra_versions.insert_one(version_doc)

    created = await db.infra_resources.find_one({"_id": resource_id})
    return InfraResource(**created)


async def get_resource(
    db: AsyncIOMotorDatabase,
    resource_id: str,
) -> Optional[InfraResource]:
    """Fetch a single resource by its _id."""
    if not ObjectId.is_valid(resource_id):
        return None
    doc = await db.infra_resources.find_one({"_id": ObjectId(resource_id)})
    return InfraResource(**doc) if doc else None


async def get_resources_by_project(
    db: AsyncIOMotorDatabase,
    project_id: str,
    resource_type: Optional[str] = None,
    env: Optional[str] = None,
) -> List[InfraResource]:
    """
    Fetch all resources for a given project_id.
    Optionally filter by type and/or env.
    """
    if not ObjectId.is_valid(project_id):
        return []

    query: Dict[str, Any] = {"project_id": ObjectId(project_id)}
    if resource_type:
        query["type"] = resource_type
    if env:
        query["env"] = env

    cursor = db.infra_resources.find(query).sort("created_at", 1)
    docs = await cursor.to_list(length=500)
    return [InfraResource(**d) for d in docs]


async def update_resource(
    db: AsyncIOMotorDatabase,
    resource_id: str,
    data: InfraResourceUpdate,
) -> Optional[InfraResource]:
    """
    Update a resource's config/state and bump its version.
    Writes a new snapshot to `infra_versions`.
    """
    if not ObjectId.is_valid(resource_id):
        return None

    oid = ObjectId(resource_id)
    existing = await db.infra_resources.find_one({"_id": oid})
    if not existing:
        return None

    now = datetime.utcnow()
    new_version = existing.get("version", 1) + 1

    update_fields: Dict[str, Any] = {
        "updated_at": now,
        "version": new_version,
    }

    if data.config is not None:
        update_fields["config"] = data.config
    if data.name is not None:
        update_fields["name"] = data.name
    if data.state is not None:
        update_fields["state"] = data.state
    if data.actual_state is not None:
        update_fields["actual_state"] = data.actual_state
    if data.depends_on is not None:
        update_fields["depends_on"] = [ObjectId(d) for d in data.depends_on]

    await db.infra_resources.update_one({"_id": oid}, {"$set": update_fields})

    # Record version snapshot
    version_doc = {
        "resource_id": oid,
        "version": new_version,
        "config": data.config if data.config is not None else existing.get("config", {}),
        "changed_by": data.changed_by,
        "change_reason": data.change_reason,
        "created_at": now,
    }
    await db.infra_versions.insert_one(version_doc)

    updated = await db.infra_resources.find_one({"_id": oid})
    return InfraResource(**updated) if updated else None


async def delete_resource(
    db: AsyncIOMotorDatabase,
    resource_id: str,
) -> dict:
    """
    Delete a single resource after checking that nothing depends on it.
    Returns {"deleted": True} or {"deleted": False, "reason": "..."}.
    """
    if not ObjectId.is_valid(resource_id):
        return {"deleted": False, "reason": "Invalid resource ID"}

    oid = ObjectId(resource_id)

    # Dependency check — are there resources that depend on this one?
    dependents = await db.infra_resources.find_one({"depends_on": oid})
    if dependents:
        dep_name = dependents.get("name", str(dependents["_id"]))
        return {
            "deleted": False,
            "reason": f"Cannot delete: resource '{dep_name}' depends on this resource. "
                      f"Remove the dependency first.",
        }

    result = await db.infra_resources.delete_one({"_id": oid})
    if result.deleted_count > 0:
        # Clean up version history
        await db.infra_versions.delete_many({"resource_id": oid})
        return {"deleted": True}
    return {"deleted": False, "reason": "Resource not found"}


async def delete_resources_by_project(
    db: AsyncIOMotorDatabase,
    project_id: str,
) -> int:
    """
    Bulk-delete ALL resources (and their versions) for a project.
    Returns number of deleted resources.
    """
    if not ObjectId.is_valid(project_id):
        return 0

    pid = ObjectId(project_id)

    # Gather resource IDs first so we can clean up versions
    cursor = db.infra_resources.find({"project_id": pid}, {"_id": 1})
    resource_ids = [doc["_id"] async for doc in cursor]

    if resource_ids:
        await db.infra_versions.delete_many({"resource_id": {"$in": resource_ids}})

    result = await db.infra_resources.delete_many({"project_id": pid})
    return result.deleted_count


# ═══════════════════════════════════════════════════════════════════════
#  VERSION HISTORY
# ═══════════════════════════════════════════════════════════════════════

async def get_resource_versions(
    db: AsyncIOMotorDatabase,
    resource_id: str,
) -> List[InfraVersion]:
    """Fetch all version snapshots for a resource, newest-first."""
    if not ObjectId.is_valid(resource_id):
        return []
    cursor = (
        db.infra_versions
        .find({"resource_id": ObjectId(resource_id)})
        .sort("version", -1)
    )
    docs = await cursor.to_list(length=100)
    return [InfraVersion(**d) for d in docs]


# ═══════════════════════════════════════════════════════════════════════
#  DEPENDENCY GRAPH
# ═══════════════════════════════════════════════════════════════════════

async def get_dependency_graph(
    db: AsyncIOMotorDatabase,
    project_id: str,
) -> List[dict]:
    """
    Build a dependency graph for all resources in a project.
    Returns a list of { id, name, type, depends_on } nodes.
    """
    resources = await get_resources_by_project(db, project_id)
    graph = []
    for r in resources:
        graph.append({
            "id": str(r.id),
            "name": r.name,
            "type": r.type,
            "state": r.state,
            "depends_on": [str(d) for d in r.depends_on] if r.depends_on else [],
        })
    return graph


# ═══════════════════════════════════════════════════════════════════════
#  EXECUTIONS
# ═══════════════════════════════════════════════════════════════════════

async def create_execution(
    db: AsyncIOMotorDatabase,
    data: InfraExecutionCreate,
) -> InfraExecution:
    """Create a new execution run record."""
    now = datetime.utcnow()
    doc = {
        "project_id": ObjectId(data.project_id),
        "execution_id": f"exec-{uuid.uuid4().hex[:12]}",
        "status": "running",
        "resources": [ObjectId(r) for r in data.resources] if data.resources else [],
        "logs": [{"timestamp": now.isoformat(), "level": "info", "message": "Execution started"}],
        "started_at": now,
        "ended_at": None,
    }
    result = await db.infra_executions.insert_one(doc)
    created = await db.infra_executions.find_one({"_id": result.inserted_id})
    return InfraExecution(**created)


async def get_execution(
    db: AsyncIOMotorDatabase,
    execution_id: str,
) -> Optional[InfraExecution]:
    """Fetch an execution by its execution_id string."""
    doc = await db.infra_executions.find_one({"execution_id": execution_id})
    return InfraExecution(**doc) if doc else None


async def update_execution(
    db: AsyncIOMotorDatabase,
    execution_id: str,
    data: InfraExecutionUpdate,
) -> Optional[InfraExecution]:
    """Update execution status and/or append a log entry."""
    update_ops: Dict[str, Any] = {}

    if data.status:
        update_ops["$set"] = {"status": data.status}
        if data.status in ("succeeded", "failed"):
            update_ops.setdefault("$set", {})["ended_at"] = datetime.utcnow()

    if data.log_entry:
        update_ops.setdefault("$push", {})["logs"] = data.log_entry

    if not update_ops:
        return None

    await db.infra_executions.update_one({"execution_id": execution_id}, update_ops)
    doc = await db.infra_executions.find_one({"execution_id": execution_id})
    return InfraExecution(**doc) if doc else None
