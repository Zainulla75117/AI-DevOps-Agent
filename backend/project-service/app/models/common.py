"""
Shared ObjectId utilities for all Pydantic models.
Centralises the PyObjectId type and serializer logic so it isn't duplicated
across every model file.
"""

from typing import Any, Optional
from bson import ObjectId
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


def get_pydantic_json_schema(
    _schema: core_schema.CoreSchema, handler
) -> JsonSchemaValue:
    return {"type": "string"}


PyObjectId = Annotated[
    ObjectId,
    core_schema.no_info_plain_validator_function(validate_object_id),
    core_schema.json_schema(get_pydantic_json_schema),
]


def serialize_object_id(value: Optional[ObjectId]) -> Optional[str]:
    """Reusable serializer for ObjectId fields."""
    return str(value) if value else None
