from langchain_core.tools import tool

@tool
def get_available_regions(provider: str) -> str:
    """Returns a list of valid regions for the given cloud provider (e.g., 'aws', 'gcp', 'azure')."""
    if provider.lower() == "aws":
        return "us-east-1, us-east-2, us-west-1, us-west-2, eu-central-1, eu-west-1"
    elif provider.lower() == "gcp":
        return "us-central1, us-east1, europe-west1"
    return "unknown provider"

@tool
def get_architecture_template(stack_type: str) -> str:
    """Returns a best-practice architecture template for a given application stack type.
    Valid stack types: 'spring_boot', 'fastapi', 'mern', 'static_frontend', 'django'.
    """
    templates = {
        "spring_boot": "ECS Fargate (Container) + RDS PostgreSQL + ALB (Application Load Balancer)",
        "fastapi": "API Gateway + Lambda (Serverless Compute) + DynamoDB/RDS",
        "mern": "EKS (Kubernetes) or ECS + DocumentDB/MongoDB Atlas + CloudFront (Frontend)",
        "static_frontend": "S3 (Storage) + CloudFront (CDN)",
        "django": "ECS Fargate + RDS PostgreSQL + ElastiCache Redis (Cache)"
    }
    return templates.get(stack_type.lower(), "Unknown stack type. Try separating into compute, database, and network.")

@tool
def validate_tf_plan(tf_json_snippet: str) -> str:
    """Mocks validation of a terraform snippet to ensure it doesn't contain critical syntax errors.
    Returns 'Valid' or an error message.
    """
    if "{" in tf_json_snippet and "}" in tf_json_snippet:
        return "Valid"
    return "Error: Invalid JSON/HCL structure."
