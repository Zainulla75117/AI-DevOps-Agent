from motor.motor_asyncio import AsyncIOMotorDatabase
from app.schemas.provisioning_context import ProvisioningContextCreate
from app.models.provisioning_context import ProvisioningContext
from typing import Optional

async def create_provisioning_context(db: AsyncIOMotorDatabase, context_in: ProvisioningContextCreate) -> ProvisioningContext:
    db_context = ProvisioningContext(**context_in.model_dump())
    result = await db.provisioning_contexts.insert_one(db_context.model_dump(by_alias=True, exclude={"id"}))
    db_context.id = result.inserted_id
    return db_context

async def get_latest_provisioning_context(db: AsyncIOMotorDatabase, project_id: str) -> Optional[ProvisioningContext]:
    doc = await db.provisioning_contexts.find_one(
        {"project_id": project_id},
        sort=[("created_at", -1)]
    )
    if doc:
        return ProvisioningContext(**doc)
    return None
