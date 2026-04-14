from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.database.connection import get_db
from app.crud import infrastructure as crud_infra
from app.schemas.infrastructure import (
    NetworkInfraCreate,
    ServersInfraCreate,
    ServerlessInfraCreate,
    CloudManagedInfraCreate,
    InfraResponse
)
from app.auth.jwt import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/infrastructure", tags=["infrastructure"])

@router.post("/network", response_model=InfraResponse, status_code=status.HTTP_201_CREATED)
async def create_network(
    infra_data: NetworkInfraCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_infra = await crud_infra.create_network_infra(db, infra_data)
        return InfraResponse(
            id=str(created_infra.id),
            message="Network infrastructure created successfully!",
            type="network",
            data=created_infra.model_dump()
        )
    except Exception as e:
        print(f"❌ Network infra creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/servers", response_model=InfraResponse, status_code=status.HTTP_201_CREATED)
async def create_servers(
    infra_data: ServersInfraCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_infra = await crud_infra.create_servers_infra(db, infra_data)
        return InfraResponse(
            id=str(created_infra.id),
            message="Servers infrastructure created successfully!",
            type="servers",
            data=created_infra.model_dump()
        )
    except Exception as e:
        print(f"❌ Servers infra creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/serverless", response_model=InfraResponse, status_code=status.HTTP_201_CREATED)
async def create_serverless(
    infra_data: ServerlessInfraCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_infra = await crud_infra.create_serverless_infra(db, infra_data)
        return InfraResponse(
            id=str(created_infra.id),
            message="Serverless infrastructure created successfully!",
            type="serverless",
            data=created_infra.model_dump()
        )
    except Exception as e:
        print(f"❌ Serverless infra creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/cloud-managed", response_model=InfraResponse, status_code=status.HTTP_201_CREATED)
async def create_cloud_managed(
    infra_data: CloudManagedInfraCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        created_infra = await crud_infra.create_cloud_managed_infra(db, infra_data)
        return InfraResponse(
            id=str(created_infra.id),
            message="Cloud Managed infrastructure created successfully!",
            type="cloud-managed",
            data=created_infra.model_dump()
        )
    except Exception as e:
        print(f"❌ Cloud Managed infra creation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/project/{project_name}", status_code=status.HTTP_200_OK)
async def get_infrastructure(
    project_name: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        infra = await crud_infra.get_infrastructure_by_project(db, project_name)
        # convert models to dump dictionaries so FastAPI can serialize easily
        return {
            "network": [n.model_dump() for n in infra["network"]],
            "servers": [s.model_dump() for s in infra["servers"]],
            "serverless": [sl.model_dump() for sl in infra["serverless"]],
            "cloud_managed": [c.model_dump() for c in infra["cloud_managed"]],
        }
    except Exception as e:
        print(f"❌ Fetching infrastructure error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/project/{project_name}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_infrastructure(
    project_name: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        await crud_infra.delete_infrastructure_by_project(db, project_name)
        return None
    except Exception as e:
        print(f"❌ Deleting infrastructure error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{infra_type}/{infra_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_specific_infrastructure(
    infra_type: str,
    infra_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        success = await crud_infra.delete_specific_infrastructure(db, infra_type, infra_id)
        if not success:
            raise HTTPException(status_code=404, detail="Infrastructure not found or invalid ID")
        return None
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Deleting specific infrastructure error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
