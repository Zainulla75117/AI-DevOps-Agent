"""
Intent and workflow schemas for the multi-LLM infrastructure pipeline.

Contains the Pydantic models used for structured LLM output (via
.with_structured_output()), workflow state tracking, and workbook
progress management.

These models are the single source of truth for:
  - What the LLM is allowed to output (ExtractionResult, ResourcePlan, SafetyReview)
  - How workflow progress is tracked (WorkbookEntry, WorkbookStatus)
  - What intents the system recognises (InfrastructureIntent)
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════════
#  INTENT ENUM
# ═══════════════════════════════════════════════════════════════════════

class InfrastructureIntent(str, Enum):
    """
    All recognised user intents.

    The LLM Extractor node classifies every user message into one of these.
    The graph router uses the intent to decide which node to run next.
    """
    CREATE_INFRA = "create_infra"
    UPDATE_INFRA = "update_infra"
    GENERAL = "general"
    CONFIRM = "confirm"
    EDIT = "edit"
    CANCEL = "cancel"
    PLAN = "plan"
    APPROVE_PLAN = "approve_plan"


# ═══════════════════════════════════════════════════════════════════════
#  WORKBOOK TRACKING
# ═══════════════════════════════════════════════════════════════════════

class WorkbookStatus(str, Enum):
    """Status of a single resource in the provisioning workbook."""
    PENDING = "pending"
    CREATING = "creating"
    CREATED = "created"
    FAILED = "failed"
    SKIPPED = "skipped"


class WorkbookEntry(BaseModel):
    """
    Tracks provisioning progress for a single resource in the plan.
    Updated by the executor node as resources are created.
    """
    order: int = Field(..., description="Execution order from the plan")
    type: str = Field(..., description="Resource type")
    name: str = Field(..., description="Resource name")
    status: WorkbookStatus = Field(default=WorkbookStatus.PENDING, description="Current provisioning status")
    resource_id: Optional[str] = Field(None, description="Database ID once created")
    error: Optional[str] = Field(None, description="Error message if creation failed")


# ═══════════════════════════════════════════════════════════════════════
#  LLM STRUCTURED OUTPUT SCHEMAS
#  These are passed to llm.with_structured_output() — the LLM must
#  conform exactly to these schemas. Keep them minimal and focused.
# ═══════════════════════════════════════════════════════════════════════

class ExtractedResource(BaseModel):
    """A resource extracted from user input during the intent phase."""
    type: str = Field(..., description="Resource type (e.g., network, compute, database)")
    name: Optional[str] = Field(None, description="Resource name if provided")
    fields: dict[str, Any] = Field(default_factory=dict, description="Configuration fields mentioned by user")
    existing_resource_id: Optional[str] = Field(None, description="ID if this is an update to an existing resource")


class ExtractionResult(BaseModel):
    """
    Output of the Extractor LLM node.

    The LLM analyses the user message and produces a structured extraction
    with intent classification, confidence scoring, and any mentioned resources.
    """
    intent: InfrastructureIntent = Field(
        ..., description="The primary intent of the user message"
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0"
    )
    risk_level: str = Field(
        ..., description="Risk level of the request (low/medium/high)"
    )
    resources: list[ExtractedResource] = Field(
        default_factory=list, description="Resources mentioned in the request"
    )
    approved_orders: list[int] = Field(
        default_factory=list, description="Order numbers approved by user (for approve_plan intent)"
    )
    message_to_user: Optional[str] = Field(
        None, description="Optional conversational response (for general intent)"
    )


class PlanResource(BaseModel):
    """A single resource within a generated infrastructure plan."""
    order: int = Field(..., ge=1, description="Execution order (1 = first)")
    type: str = Field(..., description="Resource type")
    name: str = Field(..., min_length=1, description="Resource name")
    config: dict[str, Any] = Field(default_factory=dict, description="Configuration parameters")
    depends_on: list[int] = Field(default_factory=list, description="Order numbers of dependencies")
    rationale: str = Field(..., description="Why this resource is needed")


class ResourcePlan(BaseModel):
    """
    Output of the Planner LLM node.

    A complete, dependency-ordered infrastructure plan with cost estimates
    and confidence scoring.
    """
    summary: str = Field(..., description="Brief summary of the plan")
    estimated_cost: str = Field(..., description="Estimated monthly cost (e.g., $10-20/mo)")
    resources: list[PlanResource] = Field(
        default_factory=list, description="Ordered list of resources to provision"
    )
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence score that this plan is optimal"
    )
    risk_level: str = Field(
        ..., description="Risk level of the plan (low/medium/high)"
    )


class ValidationReport(BaseModel):
    """
    Output of the deterministic Validator node.

    Produced by code-based validators (not LLM). Contains hard errors
    that block execution and soft warnings for user awareness.
    """
    is_valid: bool = Field(..., description="Whether the plan passed all validation checks")
    errors: list[str] = Field(default_factory=list, description="Critical errors that block execution")
    warnings: list[str] = Field(default_factory=list, description="Non-critical warnings")
    cost_estimate_details: Optional[dict[str, Any]] = Field(
        None, description="Detailed cost breakdown per resource"
    )


class SafetyReview(BaseModel):
    """
    Output of the Safety Review LLM node.

    Checks for security anti-patterns like public databases,
    overly permissive IAM roles, or missing encryption.
    """
    is_safe: bool = Field(default=True, description="Whether the plan is safe to execute")
    security_warnings: list[str] = Field(
        default_factory=list, description="Security warnings and recommendations"
    )
    confidence: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Confidence of the safety assessment"
    )
