from typing import Optional, Any
from datetime import datetime
from bson import ObjectId
from pydantic import BaseModel, Field, field_serializer
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import core_schema
from typing_extensions import Annotated

def validate_object_id(v: Any) -> ObjectId:
    if isinstance(v, ObjectId):
        return v
    if isinstance(v, str):
        if ObjectId.is_valid(v):
            return ObjectId(v)
        raise ValueError("Invalid ObjectId string")
    raise ValueError("Invalid ObjectId")

def get_pydantic_json_schema(_schema: core_schema.CoreSchema, handler) -> JsonSchemaValue:
    return {"type": "string"}

PyObjectId = Annotated[
    ObjectId,
    core_schema.no_info_plain_validator_function(validate_object_id),
    core_schema.json_schema(get_pydantic_json_schema)
]

class NetworkInfra(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    project_name: str
    vpc_name: str
    vpc_cidr: str
    nat_gateway: str
    public_subnet_count: int
    private_subnet_count: int
    availability_zones_count: int
    nat_gateway_az_count: int = 0
    enable_dns_hostnames: bool = True
    enable_dns_support: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ServersInfra(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    project_name: str
    instance_type: str
    instance_count: int
    os_image: str
    storage_size: int
    key_pair_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class ServerlessInfra(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    project_name: str
    runtime: str
    memory_size: int
    timeout: int
    handler: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True


class CloudManagedInfra(BaseModel):
    id: Optional[PyObjectId] = Field(default_factory=ObjectId, alias="_id")
    project_name: str
    service_type: str
    instance_class: str
    storage_size: int
    service_name: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_serializer('id')
    def serialize_id(self, value: Optional[ObjectId]) -> Optional[str]:
        return str(value) if value else None

    class Config:
        populate_by_name = True
        arbitrary_types_allowed = True
