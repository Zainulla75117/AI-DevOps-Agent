from pydantic import BaseModel, ConfigDict
from typing import Optional, Any
from datetime import datetime

class NetworkInfraCreate(BaseModel):
    project_name: str
    vpc_name: str
    vpc_cidr: str
    nat_gateway: str
    count_of_public_subnets: int
    count_of_private_subnets: int
    availability_zones_count: int
    nat_gateway_az_count: int = 0
    enable_dns_hostnames: bool = True
    enable_dns_support: bool = True

    model_config = ConfigDict(populate_by_name=True)

class ServersInfraCreate(BaseModel):
    project_name: str
    instance_type: str
    instance_count: int
    os_image: str
    storage_size: int
    key_pair_name: Optional[str] = None

class ServerlessInfraCreate(BaseModel):
    project_name: str
    runtime: str
    memory_size: int
    timeout: int
    handler: str
    description: Optional[str] = None

class CloudManagedInfraCreate(BaseModel):
    project_name: str
    service_type: str
    instance_class: str
    storage_size: int
    service_name: Optional[str] = None

class InfraResponse(BaseModel):
    id: str
    message: str
    type: str
    data: Any
