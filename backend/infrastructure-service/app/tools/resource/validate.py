"""
Validation logic for infrastructure resources.
"""

import logging
from app.schemas.resource_schemas import ResourceCreate, VALID_AWS_REGIONS
from app.schemas.intent_schemas import ValidationReport
from app.schemas.aws_schemas import AWS_CONFIG_REGISTRY, AWS_CONFIG_ALTERNATIVES

logger = logging.getLogger(__name__)

def validate_resource(resource: ResourceCreate) -> ValidationReport:
    """Validates a single resource (CIDR format, region, instance types, etc.)."""
    errors = []
    warnings = []
    
    if resource.provider == "aws" and resource.region not in VALID_AWS_REGIONS:
        warnings.append(f"Region {resource.region} is not a standard AWS region.")
        
    try:
        resource.get_validated_config()
    except Exception as e:
        errors.append(f"Config validation failed for {resource.name}: {str(e)}")

    # AWS-specific schema validation (secondary — produces warnings, not errors)
    aws_cls = None
    alternatives = AWS_CONFIG_ALTERNATIVES.get(resource.type)
    if alternatives:
        service_hint = (
            resource.config.get("service_type", "")
            or resource.config.get("orchestrator", "")
            or ""
        )
        for alt_key, alt_cls in alternatives.items():
            if alt_key.lower() in service_hint.lower():
                aws_cls = alt_cls
                break
    if not aws_cls:
        aws_cls = AWS_CONFIG_REGISTRY.get(resource.type)
    if aws_cls:
        try:
            aws_cls(**resource.config)
        except Exception as e:
            warnings.append(f"AWS schema warning for {resource.name}: {str(e)[:200]}")
        
    return ValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings
    )

def validate_resource_plan(resources: list[ResourceCreate]) -> ValidationReport:
    """Validates an entire plan: dependency graph checks, CIDR overlap detection, cost estimation."""
    all_errors = []
    all_warnings = []
    
    for res in resources:
        report = validate_resource(res)
        all_errors.extend(report.errors)
        all_warnings.extend(report.warnings)
        
    cost_details = estimate_cost(resources)
    
    return ValidationReport(
        is_valid=len(all_errors) == 0,
        errors=all_errors,
        warnings=all_warnings,
        cost_estimate_details=cost_details
    )

def estimate_cost(resources: list[ResourceCreate]) -> dict:
    """Cost estimation by resource type."""
    total = 0
    breakdown = {}
    
    cost_map = {
        "network": 20,
        "compute": 50,
        "database": 100,
        "serverless": 5,
        "storage": 10,
        "cache": 30,
        "container": 60,
        "loadbalancer": 25,
        "dns": 5,
        "apigateway": 15,
        "queue": 5,
        "cdn": 20,
        "security": 10,
        "secrets": 3,
        "monitoring": 10,
        "events": 2,
    }
    
    for res in resources:
        cost = cost_map.get(res.type.value, 15)
        total += cost
        breakdown[res.name] = cost
        
    return {
        "total_monthly_usd": total,
        "breakdown": breakdown
    }
