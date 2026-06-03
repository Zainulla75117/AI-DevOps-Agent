"""
Pydantic v2 schemas for all 14 infrastructure resource types.

Replaces the raw-dict RESOURCE_FIELD_SCHEMAS from chat/prompts.py with
proper type-safe models that include built-in validation, defaults,
and clear docstrings.

Design decisions:
  - Each resource type has its own Config model with field-level validators.
  - A discriminated union (CONFIG_REGISTRY) maps ResourceType → Config class.
  - ResourceCreate is the canonical "create a resource" input model.
  - SavedResource is the canonical "resource that exists in DB" model.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


# ═══════════════════════════════════════════════════════════════════════
#  RESOURCE TYPE ENUM
# ═══════════════════════════════════════════════════════════════════════

class ResourceType(str, Enum):
    """All supported infrastructure resource types."""
    NETWORK = "network"
    COMPUTE = "compute"
    SERVERLESS = "serverless"
    DATABASE = "database"
    STORAGE = "storage"
    APIGATEWAY = "apigateway"
    CACHE = "cache"
    CONTAINER = "container"
    QUEUE = "queue"
    CDN = "cdn"
    SECURITY = "security"
    SECRETS = "secrets"
    MONITORING = "monitoring"
    EVENTS = "events"
    LOADBALANCER = "loadbalancer"
    DNS = "dns"


# ═══════════════════════════════════════════════════════════════════════
#  SHARED VALIDATORS
# ═══════════════════════════════════════════════════════════════════════

_CIDR_RE = re.compile(r"^(\d{1,3}\.){3}\d{1,3}/\d{1,2}$")

VALID_AWS_REGIONS = frozenset({
    "us-east-1", "us-east-2", "us-west-1", "us-west-2",
    "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
    "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-south-1",
    "sa-east-1", "ca-central-1", "me-south-1", "af-south-1",
})


def _validate_cidr(value: str) -> str:
    """Validate a CIDR block format (e.g. 10.0.0.0/16)."""
    if not _CIDR_RE.match(value):
        raise ValueError(f"Invalid CIDR block: {value!r} — expected format like 10.0.0.0/16")
    return value


# ═══════════════════════════════════════════════════════════════════════
#  BASE MODEL
# ═══════════════════════════════════════════════════════════════════════

class ResourceBase(BaseModel):
    """
    Common top-level fields shared by every infrastructure resource.
    Subclassed by ResourceCreate (input) and SavedResource (output).
    """
    name: str = Field(..., min_length=1, max_length=128, description="Human-readable resource name")
    provider: str = Field(default="aws", description="Cloud provider (aws, gcp, azure)")
    region: str = Field(default="us-east-1", description="Cloud region")
    env: str = Field(default="dev", description="Deployment environment (dev, staging, qa, production)")
    tags: dict[str, str] = Field(default_factory=dict, description="Key-value resource tags")

    @field_validator("provider")
    @classmethod
    def _normalize_provider(cls, v: str) -> str:
        return v.lower().strip()

    @field_validator("env")
    @classmethod
    def _normalize_env(cls, v: str) -> str:
        return v.lower().strip()


# ═══════════════════════════════════════════════════════════════════════
#  PER-TYPE CONFIG MODELS
# ═══════════════════════════════════════════════════════════════════════

class NetworkConfig(BaseModel):
    """VPC / Networking configuration."""
    vpc_name: Optional[str] = Field(None, description="VPC name")
    vpc_cidr: str = Field(default="10.0.0.0/16", description="VPC CIDR block")
    nat_gateway: bool = Field(default=True, description="Enable NAT Gateway")
    public_subnet_count: int = Field(default=2, ge=1, le=6, description="Number of public subnets")
    private_subnet_count: int = Field(default=2, ge=1, le=6, description="Number of private subnets")
    availability_zones_count: int = Field(default=2, ge=1, le=6, description="Number of availability zones")
    enable_dns_hostnames: bool = Field(default=True, description="Enable DNS hostnames in VPC")
    enable_dns_support: bool = Field(default=True, description="Enable DNS support in VPC")
    # IaC-critical fields
    internet_gateway: bool = Field(default=True, description="Create Internet Gateway")
    public_subnet_cidrs: Optional[list[str]] = Field(None, description="Public subnet CIDR blocks (auto-calculated if empty)")
    private_subnet_cidrs: Optional[list[str]] = Field(None, description="Private subnet CIDR blocks (auto-calculated if empty)")
    enable_flow_logs: bool = Field(default=False, description="Enable VPC Flow Logs")

    @field_validator("vpc_cidr")
    @classmethod
    def _validate_vpc_cidr(cls, v: str) -> str:
        return _validate_cidr(v)


class ComputeConfig(BaseModel):
    """EC2 / Compute instance configuration."""
    instance_type: str = Field(default="t3.medium", description="EC2 instance type")
    instance_count: int = Field(default=1, ge=1, le=100, description="Number of instances")
    os_image: str = Field(default="ubuntu-22.04", description="Operating system image")
    storage_size: int = Field(default=30, ge=8, le=16384, description="Root volume size in GB")
    key_pair_name: Optional[str] = Field(None, description="SSH key pair name")
    # IaC-critical fields
    ami_id: Optional[str] = Field(None, description="Specific AMI ID (resolved from os_image)")
    subnet_placement: str = Field(default="private", description="Subnet placement (public/private)")
    security_group_rules: Optional[list[dict[str, Any]]] = Field(None, description="Security group rules")
    iam_instance_profile: Optional[str] = Field(None, description="IAM instance profile name")
    ebs_volume_type: str = Field(default="gp3", description="EBS volume type")
    ebs_iops: Optional[int] = Field(None, description="Provisioned IOPS (io1/io2 only)")
    user_data_script: Optional[str] = Field(None, description="EC2 user data / startup script")
    associate_public_ip: bool = Field(default=False, description="Associate public IP address")


class ServerlessConfig(BaseModel):
    """Lambda / Serverless function configuration."""
    runtime: str = Field(default="python3.12", description="Function runtime")
    memory_size: int = Field(default=256, ge=128, le=10240, description="Memory in MB")
    timeout: int = Field(default=30, ge=1, le=900, description="Timeout in seconds")
    handler: str = Field(default="lambda_function.handler", description="Function handler")
    description: Optional[str] = Field(None, description="Function description")
    # IaC-critical fields
    iam_role_name: Optional[str] = Field(None, description="IAM execution role name")
    environment_variables: Optional[dict[str, str]] = Field(None, description="Lambda environment variables")
    vpc_config: Optional[dict[str, Any]] = Field(None, description="VPC config for Lambda")
    layers: Optional[list[str]] = Field(None, description="Lambda layer ARNs")
    triggers: Optional[list[dict[str, Any]]] = Field(None, description="Event triggers")
    reserved_concurrency: Optional[int] = Field(None, ge=0, description="Reserved concurrent executions")


class DatabaseConfig(BaseModel):
    """RDS / Database / Managed service configuration."""
    service_type: str = Field(default="RDS", description="Service type (RDS/DynamoDB/Aurora)")
    instance_class: str = Field(default="db.t3.micro", description="DB instance class")
    storage_size: int = Field(default=20, ge=5, le=65536, description="Storage in GB")
    service_name: Optional[str] = Field(None, description="Database name")
    # IaC-critical fields
    engine: str = Field(default="postgres", description="DB engine (postgres/mysql/mariadb/aurora-postgresql)")
    engine_version: Optional[str] = Field(None, description="Engine version")
    multi_az: bool = Field(default=False, description="Multi-AZ deployment")
    backup_retention_days: int = Field(default=7, ge=0, le=35, description="Backup retention in days")
    db_subnet_group: Optional[str] = Field(None, description="DB subnet group name")
    security_group_rules: Optional[list[dict[str, Any]]] = Field(None, description="Security group rules")
    storage_type: str = Field(default="gp3", description="Storage type (gp3/io1)")
    publicly_accessible: bool = Field(default=False, description="Publicly accessible")
    master_username: str = Field(default="admin", description="Master DB username")


class StorageConfig(BaseModel):
    """S3 / Storage configuration."""
    bucket_name: Optional[str] = Field(None, description="S3 bucket name")
    versioning: bool = Field(default=False, description="Enable versioning")
    access: str = Field(default="private", description="Access level (private/public-read)")
    encryption: str = Field(default="AES256", description="Encryption (AES256/aws:kms)")
    lifecycle_days: Optional[int] = Field(None, ge=1, description="Object expiry in days")
    # IaC-critical fields
    cors_rules: Optional[list[dict[str, Any]]] = Field(None, description="CORS configuration rules")
    logging_target_bucket: Optional[str] = Field(None, description="Access log target bucket")
    replication: bool = Field(default=False, description="Enable cross-region replication")


class ApiGatewayConfig(BaseModel):
    """API Gateway configuration."""
    api_type: str = Field(default="HTTP", description="API type (HTTP/REST/WebSocket)")
    protocol: str = Field(default="HTTPS", description="Protocol (HTTPS/HTTP)")
    auth_type: str = Field(default="None", description="Auth type (None/JWT/IAM/Cognito)")
    cors_enabled: bool = Field(default=True, description="Enable CORS")
    stages: list[str] = Field(default_factory=lambda: ["dev"], description="Deployment stages")
    custom_domain_name: Optional[str] = Field(None, description="Custom domain name")
    vpc_link_enabled: bool = Field(default=False, description="Enable VPC Link")
    throttling_rate_limit: Optional[int] = Field(None, description="Throttling rate limit")
    throttling_burst_limit: Optional[int] = Field(None, description="Throttling burst limit")


class CacheConfig(BaseModel):
    """ElastiCache (Redis/Memcached) configuration."""
    engine: str = Field(default="redis", description="Cache engine (redis/memcached)")
    node_type: str = Field(default="cache.t3.micro", description="Node instance type")
    num_nodes: int = Field(default=1, ge=1, le=20, description="Number of cache nodes")
    engine_version: Optional[str] = Field(None, description="Engine version")
    port: int = Field(default=6379, description="Cache port")
    subnet_group_name: Optional[str] = Field(None, description="Cache subnet group name")
    security_group_rules: Optional[list[dict[str, Any]]] = Field(None, description="Security group rules")
    multi_az_enabled: bool = Field(default=False, description="Enable Multi-AZ")
    auth_token_enabled: bool = Field(default=False, description="Require auth token (Redis AUTH)")


class ContainerConfig(BaseModel):
    """ECS Fargate / EKS container configuration."""
    orchestrator: str = Field(default="ECS-Fargate", description="Orchestrator (ECS-Fargate/EKS)")
    cluster_name: Optional[str] = Field(None, description="Cluster name")
    task_cpu: int = Field(default=256, description="Task CPU units")
    task_memory: int = Field(default=512, description="Task memory in MB")
    desired_count: int = Field(default=1, ge=0, le=100, description="Desired container count")
    vpc_subnets: Optional[list[str]] = Field(None, description="VPC Subnets")
    security_group_rules: Optional[list[dict[str, Any]]] = Field(None, description="Security group rules")
    container_image: Optional[str] = Field(None, description="Container image URI")
    container_port: int = Field(default=80, description="Container port")
    iam_execution_role: Optional[str] = Field(None, description="IAM execution role name/ARN")
    iam_task_role: Optional[str] = Field(None, description="IAM task role name/ARN")
    load_balancer_arn: Optional[str] = Field(None, description="Target group / Load balancer ARN")


class QueueConfig(BaseModel):
    """SQS / SNS message queue configuration."""
    service_type: str = Field(default="SQS", description="Service type (SQS/SNS)")
    queue_name: Optional[str] = Field(None, description="Queue/Topic name")
    fifo_queue: bool = Field(default=False, description="Is FIFO queue/topic")
    visibility_timeout: int = Field(default=30, ge=0, le=43200, description="Visibility timeout in seconds")
    message_retention_seconds: int = Field(default=345600, ge=60, le=1209600, description="Message retention in seconds")
    delay_seconds: int = Field(default=0, ge=0, le=900, description="Delivery delay in seconds")
    dead_letter_queue_arn: Optional[str] = Field(None, description="Dead letter queue ARN")
    max_receive_count: int = Field(default=3, ge=1, description="Max receive count before DLQ")
    kms_master_key_id: Optional[str] = Field(None, description="KMS key for encryption")


class CdnConfig(BaseModel):
    """CloudFront CDN configuration."""
    distribution_name: Optional[str] = Field(None, description="Distribution name")
    origin_type: str = Field(default="S3", description="Origin type (S3/Custom)")
    origin_domain: Optional[str] = Field(None, description="Origin domain name")
    aliases: Optional[list[str]] = Field(None, description="Custom domain aliases")
    acm_certificate_arn: Optional[str] = Field(None, description="ACM certificate ARN")
    price_class: str = Field(default="PriceClass_100", description="Price class")
    waf_web_acl_id: Optional[str] = Field(None, description="WAF Web ACL ID")
    viewer_protocol_policy: str = Field(default="redirect-to-https", description="Viewer protocol policy")


class SecurityConfig(BaseModel):
    """GuardDuty / WAF / SecurityHub configuration."""
    service_type: str = Field(default="GuardDuty", description="Service type (GuardDuty/WAF/SecurityHub)")
    enable_guardduty: bool = Field(default=True, description="Enable GuardDuty detector")
    finding_publishing_frequency: str = Field(default="FIFTEEN_MINUTES", description="Finding publishing frequency")
    s3_protection_enabled: bool = Field(default=True, description="Enable S3 protection")
    eks_protection_enabled: bool = Field(default=False, description="Enable EKS protection")
    malware_protection_enabled: bool = Field(default=False, description="Enable malware protection")


class SecretsConfig(BaseModel):
    """Secrets Manager / Parameter Store configuration."""
    service_type: str = Field(default="SecretsManager", description="Service type (SecretsManager/ParameterStore)")
    secret_name: Optional[str] = Field(None, description="Secret name / path")
    description: Optional[str] = Field(None, description="Secret description")
    kms_key_id: Optional[str] = Field(None, description="KMS key ID for encryption")
    rotation_lambda_arn: Optional[str] = Field(None, description="Rotation Lambda ARN")
    rotation_rules_days: Optional[int] = Field(None, ge=1, le=365, description="Rotation frequency in days")


class MonitoringConfig(BaseModel):
    """CloudWatch / X-Ray observability configuration."""
    service_type: str = Field(default="CloudWatch", description="Service type (CloudWatch/X-Ray)")
    log_group_name: Optional[str] = Field(None, description="Log group name")
    retention_in_days: int = Field(default=30, ge=1, le=3653, description="Log retention in days")
    kms_key_id: Optional[str] = Field(None, description="KMS key for log encryption")
    alarm_definitions: Optional[list[dict[str, Any]]] = Field(None, description="Alarm definitions")
    dashboard_body: Optional[str] = Field(None, description="Dashboard JSON body")


class EventsConfig(BaseModel):
    """EventBridge rules and schedules configuration."""
    bus_name: str = Field(default="default", description="Event bus name")
    rule_name: Optional[str] = Field(None, description="Event rule name")
    schedule_expression: Optional[str] = Field(None, description="Schedule expression")
    event_pattern: Optional[dict[str, Any]] = Field(None, description="Event pattern JSON")
    targets: Optional[list[str]] = Field(None, description="Target ARNs")
    role_arn: Optional[str] = Field(None, description="IAM role ARN")


class LoadBalancerConfig(BaseModel):
    """ALB / NLB load balancer configuration."""
    lb_type: str = Field(default="application", description="Load balancer type (application/network)")
    scheme: str = Field(default="internet-facing", description="Scheme (internet-facing/internal)")
    listener_port: int = Field(default=443, description="Listener port")
    listener_protocol: str = Field(default="HTTPS", description="Listener protocol (HTTP/HTTPS)")
    target_port: int = Field(default=80, description="Target port")
    target_protocol: str = Field(default="HTTP", description="Target protocol (HTTP/HTTPS)")
    target_type: str = Field(default="ip", description="Target type (ip/instance/lambda)")
    health_check_path: str = Field(default="/health", description="Health check path")
    acm_certificate_arn: Optional[str] = Field(None, description="ACM certificate ARN for HTTPS")
    idle_timeout: int = Field(default=60, description="Idle timeout in seconds")
    deletion_protection: bool = Field(default=False, description="Enable deletion protection")


class DnsConfig(BaseModel):
    """Route53 DNS configuration."""
    hosted_zone_name: Optional[str] = Field(None, description="Hosted zone domain name")
    is_private_zone: bool = Field(default=False, description="Private hosted zone")
    record_name: Optional[str] = Field(None, description="DNS record name")
    record_type: str = Field(default="A", description="Record type (A/AAAA/CNAME/MX/TXT)")
    record_ttl: int = Field(default=300, description="TTL in seconds")
    record_values: Optional[list[str]] = Field(None, description="Record values")
    alias_target: Optional[str] = Field(None, description="Alias target DNS name")
    routing_policy: str = Field(default="simple", description="Routing policy (simple/weighted/latency/failover)")


# ═══════════════════════════════════════════════════════════════════════
#  CONFIG REGISTRY — Maps ResourceType → Config class
# ═══════════════════════════════════════════════════════════════════════

CONFIG_REGISTRY: dict[ResourceType, type[BaseModel]] = {
    ResourceType.NETWORK: NetworkConfig,
    ResourceType.COMPUTE: ComputeConfig,
    ResourceType.SERVERLESS: ServerlessConfig,
    ResourceType.DATABASE: DatabaseConfig,
    ResourceType.STORAGE: StorageConfig,
    ResourceType.APIGATEWAY: ApiGatewayConfig,
    ResourceType.CACHE: CacheConfig,
    ResourceType.CONTAINER: ContainerConfig,
    ResourceType.QUEUE: QueueConfig,
    ResourceType.CDN: CdnConfig,
    ResourceType.SECURITY: SecurityConfig,
    ResourceType.SECRETS: SecretsConfig,
    ResourceType.MONITORING: MonitoringConfig,
    ResourceType.EVENTS: EventsConfig,
    ResourceType.LOADBALANCER: LoadBalancerConfig,
    ResourceType.DNS: DnsConfig,
}


# ═══════════════════════════════════════════════════════════════════════
#  CANONICAL INPUT / OUTPUT MODELS
# ═══════════════════════════════════════════════════════════════════════

class ResourceCreate(ResourceBase):
    """
    Canonical model for creating an infrastructure resource.

    Accepts a resource type and a type-specific config dict.
    The config is validated against the appropriate Config model
    via the CONFIG_REGISTRY at construction time.
    """
    project_id: str = Field(..., min_length=1, description="Parent project ID")
    type: ResourceType = Field(..., description="Infrastructure resource type")
    config: dict[str, Any] = Field(default_factory=dict, description="Type-specific configuration")
    depends_on: list[str] = Field(default_factory=list, description="IDs of resources this depends on")
    state: str = Field(default="planned", description="Resource state (planned/provisioned/failed)")
    iac_context: Optional[dict[str, Any]] = Field(None, description="IaC generation context from LLM reasoning")

    @field_validator("config")
    @classmethod
    def _validate_config_structure(cls, v: dict[str, Any]) -> dict[str, Any]:
        """Basic structural check — full validation is done by validate_resource() tool."""
        if not isinstance(v, dict):
            raise ValueError("config must be a dictionary")
        return v

    def get_validated_config(self) -> BaseModel:
        """
        Parse self.config through the typed Config model for this resource type.
        Returns a validated Pydantic model instance.
        Raises ValidationError if config doesn't match the schema.
        """
        config_cls = CONFIG_REGISTRY.get(self.type)
        if not config_cls:
            raise ValueError(f"Unknown resource type: {self.type}")
        return config_cls(**self.config)


class SavedResource(BaseModel):
    """
    A resource that has been persisted to the database.
    Returned by ResourceService after create/update operations.
    """
    id: str = Field(..., description="Database resource ID")
    type: str = Field(..., description="Resource type")
    name: str = Field(..., description="Resource name")
    state: str = Field(default="planned", description="Resource state")
    action: str = Field(default="created", description="Last action (created/updated)")
    config: dict[str, Any] = Field(default_factory=dict, description="Resource configuration")
    iac_context: Optional[dict[str, Any]] = Field(None, description="IaC generation context")
    provider: Optional[str] = Field(None, description="Cloud provider")
    region: Optional[str] = Field(None, description="Cloud region")
    env: Optional[str] = Field(None, description="Environment")
    version: Optional[int] = Field(None, description="Resource version")
