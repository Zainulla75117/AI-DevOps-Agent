"""
Resource tools — deterministic infrastructure resource processing pipeline.

Stages:
  1. collect  — Normalise raw LLM output into validated ResourceCreate models.
  2. validate — Run deterministic checks (CIDR, regions, deps, cost).
  3. enrich   — Apply project defaults, auto-name, resolve dependencies.
  4. transform — Convert to API payloads, workbook entries, saved resources.
"""

from app.tools.resource.collect import collect_resource_schema, collect_from_plan
from app.tools.resource.validate import validate_resource, validate_resource_plan, estimate_cost
from app.tools.resource.enrich import enrich_resource, resolve_dependencies, auto_name_resource
from app.tools.resource.transform import (
    to_api_payload,
    to_api_payloads,
    to_workbook_entry,
    to_workbook,
    to_saved_resource,
)

__all__ = [
    # collect
    "collect_resource_schema",
    "collect_from_plan",
    # validate
    "validate_resource",
    "validate_resource_plan",
    "estimate_cost",
    # enrich
    "enrich_resource",
    "resolve_dependencies",
    "auto_name_resource",
    # transform
    "to_api_payload",
    "to_api_payloads",
    "to_workbook_entry",
    "to_workbook",
    "to_saved_resource",
]
