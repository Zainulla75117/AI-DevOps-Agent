from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime

from app.models.infrastructure import NetworkInfra, ServersInfra, ServerlessInfra, CloudManagedInfra
from app.schemas.infrastructure import (
    NetworkInfraCreate,
    ServersInfraCreate,
    ServerlessInfraCreate,
    CloudManagedInfraCreate
)

async def create_network_infra(db: AsyncIOMotorDatabase, network_data: NetworkInfraCreate) -> NetworkInfra:
    # Handle the mapping from frontend schema to DB model.
    data_dict = network_data.model_dump()
    data_dict["public_subnet_count"] = data_dict.pop("count_of_public_subnets")
    data_dict["private_subnet_count"] = data_dict.pop("count_of_private_subnets")
    
    data_dict["created_at"] = datetime.utcnow()
    result = await db.network_infra.insert_one(data_dict)
    created_infra = await db.network_infra.find_one({"_id": result.inserted_id})
    return NetworkInfra(**created_infra)

async def create_servers_infra(db: AsyncIOMotorDatabase, servers_data: ServersInfraCreate) -> ServersInfra:
    data_dict = servers_data.model_dump()
    data_dict["created_at"] = datetime.utcnow()
    result = await db.servers_infra.insert_one(data_dict)
    created_infra = await db.servers_infra.find_one({"_id": result.inserted_id})
    return ServersInfra(**created_infra)

async def create_serverless_infra(db: AsyncIOMotorDatabase, serverless_data: ServerlessInfraCreate) -> ServerlessInfra:
    data_dict = serverless_data.model_dump()
    data_dict["created_at"] = datetime.utcnow()
    result = await db.serverless_infra.insert_one(data_dict)
    created_infra = await db.serverless_infra.find_one({"_id": result.inserted_id})
    return ServerlessInfra(**created_infra)

async def create_cloud_managed_infra(db: AsyncIOMotorDatabase, cloud_data: CloudManagedInfraCreate) -> CloudManagedInfra:
    data_dict = cloud_data.model_dump()
    data_dict["created_at"] = datetime.utcnow()
    result = await db.cloud_managed_infra.insert_one(data_dict)
    created_infra = await db.cloud_managed_infra.find_one({"_id": result.inserted_id})
    return CloudManagedInfra(**created_infra)

async def get_infrastructure_by_project(db: AsyncIOMotorDatabase, project_name: str) -> dict:
    network_cursor = db.network_infra.find({"project_name": project_name})
    servers_cursor = db.servers_infra.find({"project_name": project_name})
    serverless_cursor = db.serverless_infra.find({"project_name": project_name})
    cloud_managed_cursor = db.cloud_managed_infra.find({"project_name": project_name})
    
    networks = await network_cursor.to_list(length=100)
    servers = await servers_cursor.to_list(length=100)
    serverless = await serverless_cursor.to_list(length=100)
    cloud_managed = await cloud_managed_cursor.to_list(length=100)
    
    return {
        "network": [NetworkInfra(**n) for n in networks],
        "servers": [ServersInfra(**s) for s in servers],
        "serverless": [ServerlessInfra(**sl) for sl in serverless],
        "cloud_managed": [CloudManagedInfra(**c) for c in cloud_managed]
    }

async def delete_specific_infrastructure(db: AsyncIOMotorDatabase, infra_type: str, infra_id: str) -> bool:
    from bson.errors import InvalidId
    try:
        object_id = ObjectId(infra_id)
    except InvalidId:
        return False
        
    if infra_type == 'network':
        result = await db.network_infra.delete_one({"_id": object_id})
    elif infra_type == 'servers':
        result = await db.servers_infra.delete_one({"_id": object_id})
    elif infra_type == 'serverless':
        result = await db.serverless_infra.delete_one({"_id": object_id})
    elif infra_type == 'cloud-managed':
        result = await db.cloud_managed_infra.delete_one({"_id": object_id})
    else:
        return False
        
    return result.deleted_count > 0

async def delete_infrastructure_by_project(db: AsyncIOMotorDatabase, project_name: str) -> bool:
    await db.network_infra.delete_many({"project_name": project_name})
    await db.servers_infra.delete_many({"project_name": project_name})
    await db.serverless_infra.delete_many({"project_name": project_name})
    await db.cloud_managed_infra.delete_many({"project_name": project_name})
    return True
