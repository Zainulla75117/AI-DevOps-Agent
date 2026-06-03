import logging
from typing import Dict, Any, List
from chat.schemas import ValidationReport, PlanResource

logger = logging.getLogger(__name__)

def validate_aws_region(region: str) -> bool:
    """Mock validation for AWS region."""
    valid_regions = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "eu-central-1", "eu-west-1"]
    return region in valid_regions

def validate_instance_type(instance_type: str) -> bool:
    """Mock validation for EC2 instance types."""
    valid_types = ["t3.micro", "t3.medium", "t3.large", "m5.large", "c5.large"]
    return instance_type in valid_types

def validate_cidr(cidr: str) -> bool:
    """Mock validation for CIDR block format."""
    import re
    return bool(re.match(r"^([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}$", cidr))

def estimate_cost(resources: List[PlanResource]) -> Dict[str, Any]:
    """Mock cost estimation based on resource types."""
    total_cost = 0
    breakdown = {}
    
    cost_map = {
        "network": 20,
        "compute": 50,
        "database": 100,
        "serverless": 10,
        "storage": 5,
        "cache": 40,
        "container": 30,
        "apigateway": 5,
        "queue": 2,
        "cdn": 15,
        "security": 10,
        "secrets": 2,
        "monitoring": 10,
        "events": 1
    }
    
    for r in resources:
        cost = cost_map.get(r.type, 0)
        total_cost += cost
        breakdown[r.name] = cost
        
    return {
        "total_monthly_usd": total_cost,
        "breakdown": breakdown,
        "expensive_resources": [name for name, cost in breakdown.items() if cost > 50]
    }

def validate_plan(resources: List[PlanResource]) -> ValidationReport:
    """Run validations on the generated plan before safety review."""
    errors = []
    warnings = []
    
    for r in resources:
        # Generic config checks
        if r.type == "network" and "vpc_cidr" in r.config:
            if not validate_cidr(r.config["vpc_cidr"]):
                errors.append(f"Invalid CIDR block for {r.name}: {r.config['vpc_cidr']}")
                
        if r.type == "compute" and "instance_type" in r.config:
            if not validate_instance_type(r.config["instance_type"]):
                warnings.append(f"Instance type {r.config['instance_type']} for {r.name} might not be supported in all AZs.")
                
        if "region" in r.config:
            if not validate_aws_region(r.config["region"]):
                errors.append(f"Unsupported AWS region for {r.name}: {r.config['region']}")
                
    # Dependency check
    order_ids = {r.order for r in resources}
    for r in resources:
        for dep in r.depends_on:
            if dep not in order_ids:
                errors.append(f"Resource {r.name} depends on missing resource order {dep}")
            if dep >= r.order:
                errors.append(f"Resource {r.name} (order {r.order}) has invalid dependency on {dep} (must be strictly less)")
                
    cost_details = estimate_cost(resources)
    
    return ValidationReport(
        is_valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        cost_estimate_details=cost_details
    )
