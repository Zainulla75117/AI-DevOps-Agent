"""
AWS-specific Pydantic schemas for structured LLM output extraction.

Each class represents the complete configuration required to provision
a specific AWS resource. Fields use descriptive `Field()` metadata
so the LLM knows exactly what to extract from natural language.

Design decisions:
  - Flat models (no nesting) for reliable structured output parsing.
  - Optional with sensible defaults — the LLM fills what it can,
    the rest gets production-ready defaults.
  - AWS_CONFIG_REGISTRY maps ResourceType → primary AWS config class.
  - AWS_CONFIG_ALTERNATIVES holds sub-type variants (DynamoDB, SNS, EKS).
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.resource_schemas import ResourceType


# ═══════════════════════════════════════════════════════════════════════
#  1. EC2 INSTANCE (compute)
# ═══════════════════════════════════════════════════════════════════════

class EC2InstanceConfig(BaseModel):
    """Configuration required to create an AWS EC2 instance."""

    instance_name: str = Field(description="Name of the EC2 instance")
    ami_id: Optional[str] = Field(default=None, description="Amazon Machine Image (AMI) ID")
    instance_type: str = Field(default="t3.micro", description="EC2 instance type (e.g., t3.micro, m5.large)")
    key_pair_name: Optional[str] = Field(default=None, description="SSH key pair name for remote access")
    security_group_ids: list[str] = Field(default_factory=list, description="List of security group IDs to attach")
    subnet_id: Optional[str] = Field(default=None, description="Subnet ID where the instance will be launched")
    vpc_id: Optional[str] = Field(default=None, description="VPC ID the instance belongs to")
    availability_zone: Optional[str] = Field(default=None, description="Availability Zone (e.g., us-east-1a)")
    root_volume_size_gb: int = Field(default=30, description="Root EBS volume size in GB")
    root_volume_type: str = Field(default="gp3", description="Root EBS volume type (gp3, gp2, io2, etc.)")
    public_ip_enabled: bool = Field(default=False, description="Assign a public IP address")
    iam_role_name: Optional[str] = Field(default=None, description="IAM role / instance profile attached to the instance")
    user_data_script: str = Field(default="", description="Startup script executed during launch")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  2. VPC (network)
# ═══════════════════════════════════════════════════════════════════════

class VPCConfig(BaseModel):
    """Configuration required to create an AWS VPC with subnets."""

    vpc_name: str = Field(description="Name of the VPC")
    vpc_cidr_block: str = Field(default="10.0.0.0/16", description="CIDR block for the VPC")
    enable_dns_hostnames: bool = Field(default=True, description="Enable DNS hostnames in VPC")
    enable_dns_support: bool = Field(default=True, description="Enable DNS support in VPC")
    public_subnet_cidrs: list[str] = Field(
        default_factory=lambda: ["10.0.1.0/24", "10.0.2.0/24"],
        description="CIDR blocks for public subnets",
    )
    private_subnet_cidrs: list[str] = Field(
        default_factory=lambda: ["10.0.3.0/24", "10.0.4.0/24"],
        description="CIDR blocks for private subnets",
    )
    availability_zones: list[str] = Field(
        default_factory=lambda: ["us-east-1a", "us-east-1b"],
        description="Availability zones to spread subnets across",
    )
    create_internet_gateway: bool = Field(default=True, description="Create and attach an Internet Gateway")
    create_nat_gateway: bool = Field(default=True, description="Create a NAT Gateway for private subnets")
    nat_gateway_count: int = Field(default=1, description="Number of NAT Gateways (1 for single-AZ, match AZ count for HA)")
    enable_flow_logs: bool = Field(default=False, description="Enable VPC Flow Logs to CloudWatch")
    flow_log_destination: str = Field(default="cloud-watch-logs", description="Flow log destination (cloud-watch-logs or s3)")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  3. LAMBDA FUNCTION (serverless)
# ═══════════════════════════════════════════════════════════════════════

class LambdaFunctionConfig(BaseModel):
    """Configuration required to create an AWS Lambda function."""

    function_name: str = Field(description="Name of the Lambda function")
    runtime: str = Field(default="python3.12", description="Lambda runtime (python3.12, nodejs20.x, java21, etc.)")
    handler: str = Field(default="lambda_function.handler", description="Function handler (file.function)")
    memory_size_mb: int = Field(default=256, description="Memory allocation in MB (128-10240)")
    timeout_seconds: int = Field(default=30, description="Execution timeout in seconds (1-900)")
    description: str = Field(default="", description="Description of the function's purpose")
    iam_role_arn: Optional[str] = Field(default=None, description="ARN of the IAM execution role")
    environment_variables: dict[str, str] = Field(default_factory=dict, description="Environment variables for the function")
    vpc_subnet_ids: list[str] = Field(default_factory=list, description="Subnet IDs if Lambda runs inside a VPC")
    vpc_security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs for VPC-attached Lambda")
    layers: list[str] = Field(default_factory=list, description="Lambda layer ARNs to attach")
    reserved_concurrency: int = Field(default=-1, description="Reserved concurrent executions (-1 for unreserved)")
    ephemeral_storage_mb: int = Field(default=512, description="Ephemeral /tmp storage in MB (512-10240)")
    architectures: list[str] = Field(
        default_factory=lambda: ["x86_64"],
        description="Instruction set architectures (x86_64 or arm64)",
    )
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  4. RDS INSTANCE (database)
# ═══════════════════════════════════════════════════════════════════════

class RDSInstanceConfig(BaseModel):
    """Configuration required to create an AWS RDS database instance."""

    db_instance_identifier: str = Field(description="Unique identifier for the DB instance")
    engine: str = Field(default="postgres", description="Database engine (postgres, mysql, mariadb, aurora-postgresql, aurora-mysql)")
    engine_version: Optional[str] = Field(default=None, description="Engine version (e.g., 16.4 for PostgreSQL)")
    instance_class: str = Field(default="db.t3.micro", description="DB instance class (e.g., db.t3.micro, db.r6g.large)")
    allocated_storage_gb: int = Field(default=20, description="Allocated storage in GB")
    storage_type: str = Field(default="gp3", description="Storage type (gp3, gp2, io1, io2)")
    master_username: str = Field(default="admin", description="Master database username")
    master_password_secret_arn: Optional[str] = Field(default=None, description="Secrets Manager ARN for master password (auto-generate if empty)")
    db_name: Optional[str] = Field(default=None, description="Name of the initial database to create")
    vpc_security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs for the DB instance")
    db_subnet_group_name: Optional[str] = Field(default=None, description="DB subnet group name for VPC placement")
    availability_zone: Optional[str] = Field(default=None, description="Availability zone (leave empty for Multi-AZ)")
    multi_az: bool = Field(default=False, description="Enable Multi-AZ deployment for high availability")
    publicly_accessible: bool = Field(default=False, description="Allow public access to the database")
    backup_retention_days: int = Field(default=7, description="Automated backup retention period in days (0-35)")
    deletion_protection: bool = Field(default=True, description="Enable deletion protection")
    storage_encrypted: bool = Field(default=True, description="Enable storage encryption at rest")
    kms_key_id: Optional[str] = Field(default=None, description="KMS key ID for encryption (uses AWS default if empty)")
    performance_insights_enabled: bool = Field(default=False, description="Enable Performance Insights")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  5. S3 BUCKET (storage)
# ═══════════════════════════════════════════════════════════════════════

class S3BucketConfig(BaseModel):
    """Configuration required to create an AWS S3 bucket."""

    bucket_name: str = Field(description="Globally unique S3 bucket name")
    versioning_enabled: bool = Field(default=False, description="Enable object versioning")
    encryption_type: str = Field(default="AES256", description="Server-side encryption (AES256 or aws:kms)")
    kms_key_arn: Optional[str] = Field(default=None, description="KMS key ARN for encryption (when using aws:kms)")
    block_public_access: bool = Field(default=True, description="Block all public access to the bucket")
    lifecycle_expiration_days: int = Field(default=0, description="Auto-delete objects after N days (0 = disabled)")
    lifecycle_transition_glacier_days: int = Field(default=0, description="Transition to Glacier after N days (0 = disabled)")
    cors_allowed_origins: list[str] = Field(default_factory=list, description="CORS allowed origins (e.g., ['https://example.com'])")
    cors_allowed_methods: list[str] = Field(
        default_factory=lambda: ["GET"],
        description="CORS allowed methods (GET, PUT, POST, DELETE, HEAD)",
    )
    enable_access_logging: bool = Field(default=False, description="Enable server access logging")
    logging_target_bucket: Optional[str] = Field(default=None, description="Target bucket for access logs")
    enable_replication: bool = Field(default=False, description="Enable cross-region replication")
    replication_destination_bucket_arn: Optional[str] = Field(default=None, description="Destination bucket ARN for replication")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  6. API GATEWAY (apigateway)
# ═══════════════════════════════════════════════════════════════════════

class APIGatewayConfig(BaseModel):
    """Configuration required to create an AWS API Gateway."""

    api_name: str = Field(description="Name of the API Gateway")
    api_type: str = Field(default="HTTP", description="API type (HTTP, REST, or WEBSOCKET)")
    protocol_type: str = Field(default="HTTPS", description="Protocol (HTTPS or HTTP)")
    description: str = Field(default="", description="Description of the API")
    cors_allow_origins: list[str] = Field(
        default_factory=lambda: ["*"],
        description="CORS allowed origins",
    )
    cors_allow_methods: list[str] = Field(
        default_factory=lambda: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        description="CORS allowed methods",
    )
    cors_allow_headers: list[str] = Field(
        default_factory=lambda: ["Content-Type", "Authorization"],
        description="CORS allowed headers",
    )
    authorization_type: str = Field(default="NONE", description="Authorization type (NONE, JWT, AWS_IAM, COGNITO)")
    stage_name: str = Field(default="dev", description="Deployment stage name")
    auto_deploy: bool = Field(default=True, description="Enable auto-deploy for the stage")
    throttling_rate_limit: int = Field(default=1000, description="Throttling rate limit (requests/second)")
    throttling_burst_limit: int = Field(default=500, description="Throttling burst limit")
    custom_domain_name: Optional[str] = Field(default=None, description="Custom domain name for the API")
    acm_certificate_arn: Optional[str] = Field(default=None, description="ACM certificate ARN for custom domain HTTPS")
    vpc_link_id: Optional[str] = Field(default=None, description="VPC Link ID for private integrations")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  7. ELASTICACHE (cache)
# ═══════════════════════════════════════════════════════════════════════

class ElastiCacheConfig(BaseModel):
    """Configuration required to create an AWS ElastiCache cluster."""

    cluster_name: str = Field(description="Name of the ElastiCache cluster")
    engine: str = Field(default="redis", description="Cache engine (redis or memcached)")
    engine_version: Optional[str] = Field(default=None, description="Engine version (e.g., 7.1)")
    node_type: str = Field(default="cache.t3.micro", description="Cache node type (e.g., cache.t3.micro, cache.r6g.large)")
    num_cache_nodes: int = Field(default=1, description="Number of cache nodes")
    port: int = Field(default=6379, description="Port number for the cache")
    subnet_group_name: Optional[str] = Field(default=None, description="Cache subnet group name for VPC placement")
    security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs to associate")
    parameter_group_name: Optional[str] = Field(default=None, description="Cache parameter group name (uses default if empty)")
    multi_az_enabled: bool = Field(default=False, description="Enable Multi-AZ with automatic failover")
    automatic_failover_enabled: bool = Field(default=False, description="Enable automatic failover (requires 2+ nodes)")
    at_rest_encryption_enabled: bool = Field(default=True, description="Enable encryption at rest")
    transit_encryption_enabled: bool = Field(default=True, description="Enable in-transit encryption")
    auth_token: Optional[str] = Field(default=None, description="Redis AUTH token (password) for access control")
    snapshot_retention_days: int = Field(default=0, description="Snapshot retention period in days (0 = disabled)")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  8. ECS FARGATE (container)
# ═══════════════════════════════════════════════════════════════════════

class ECSFargateConfig(BaseModel):
    """Configuration required to create an AWS ECS Fargate service."""

    cluster_name: str = Field(description="Name of the ECS cluster")
    service_name: str = Field(description="Name of the ECS service")
    task_definition_family: Optional[str] = Field(default=None, description="Task definition family name")
    container_image: Optional[str] = Field(default=None, description="Docker image URI (e.g., 123456.dkr.ecr.us-east-1.amazonaws.com/app:latest)")
    container_port: int = Field(default=80, description="Port the container listens on")
    cpu: int = Field(default=256, description="Task CPU units (256, 512, 1024, 2048, 4096)")
    memory: int = Field(default=512, description="Task memory in MB (512, 1024, 2048, etc.)")
    desired_count: int = Field(default=1, description="Desired number of running tasks")
    subnet_ids: list[str] = Field(default_factory=list, description="Subnet IDs to launch tasks in")
    security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs for the tasks")
    assign_public_ip: bool = Field(default=False, description="Assign public IP to tasks (needed for public subnets)")
    execution_role_arn: Optional[str] = Field(default=None, description="IAM execution role ARN (for pulling images, logging)")
    task_role_arn: Optional[str] = Field(default=None, description="IAM task role ARN (for AWS API calls from container)")
    load_balancer_target_group_arn: Optional[str] = Field(default=None, description="ALB target group ARN for load balancing")
    health_check_path: str = Field(default="/health", description="Health check path for the target group")
    environment_variables: dict[str, str] = Field(default_factory=dict, description="Environment variables for the container")
    log_group_name: Optional[str] = Field(default=None, description="CloudWatch log group name for container logs")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  9. SQS QUEUE (queue)
# ═══════════════════════════════════════════════════════════════════════

class SQSQueueConfig(BaseModel):
    """Configuration required to create an AWS SQS queue."""

    queue_name: str = Field(description="Name of the SQS queue")
    fifo_queue: bool = Field(default=False, description="Create as FIFO queue (exactly-once processing)")
    content_based_deduplication: bool = Field(default=False, description="Enable content-based deduplication (FIFO only)")
    visibility_timeout_seconds: int = Field(default=30, description="Visibility timeout in seconds (0-43200)")
    message_retention_seconds: int = Field(default=345600, description="Message retention period in seconds (60-1209600)")
    delay_seconds: int = Field(default=0, description="Delivery delay in seconds (0-900)")
    max_message_size_bytes: int = Field(default=262144, description="Maximum message size in bytes (1024-262144)")
    receive_wait_time_seconds: int = Field(default=0, description="Long polling wait time in seconds (0-20)")
    dead_letter_queue_arn: Optional[str] = Field(default=None, description="Dead letter queue ARN for failed messages")
    max_receive_count: int = Field(default=3, description="Max receive count before sending to DLQ")
    kms_master_key_id: Optional[str] = Field(default=None, description="KMS key ID for server-side encryption")
    sqs_managed_sse_enabled: bool = Field(default=True, description="Enable SQS-managed SSE encryption")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  10. CLOUDFRONT DISTRIBUTION (cdn)
# ═══════════════════════════════════════════════════════════════════════

class CloudFrontDistributionConfig(BaseModel):
    """Configuration required to create an AWS CloudFront distribution."""

    distribution_name: str = Field(description="Descriptive name for the distribution")
    origin_domain_name: Optional[str] = Field(default=None, description="Origin domain name (S3 bucket or custom origin)")
    origin_type: str = Field(default="s3", description="Origin type (s3 or custom)")
    origin_access_identity: Optional[str] = Field(default=None, description="CloudFront Origin Access Identity for S3")
    default_root_object: str = Field(default="index.html", description="Default root object")
    enabled: bool = Field(default=True, description="Enable the distribution")
    aliases: list[str] = Field(default_factory=list, description="Custom domain names (CNAMEs)")
    acm_certificate_arn: Optional[str] = Field(default=None, description="ACM certificate ARN for HTTPS (us-east-1 only)")
    viewer_protocol_policy: str = Field(default="redirect-to-https", description="Viewer protocol policy (allow-all, https-only, redirect-to-https)")
    price_class: str = Field(default="PriceClass_100", description="Price class (PriceClass_100, PriceClass_200, PriceClass_All)")
    min_ttl: int = Field(default=0, description="Minimum cache TTL in seconds")
    default_ttl: int = Field(default=86400, description="Default cache TTL in seconds")
    max_ttl: int = Field(default=31536000, description="Maximum cache TTL in seconds")
    web_acl_id: Optional[str] = Field(default=None, description="WAF Web ACL ID for security filtering")
    geo_restriction_type: str = Field(default="none", description="Geo restriction type (none, whitelist, blacklist)")
    geo_restriction_locations: list[str] = Field(default_factory=list, description="Country codes for geo restriction")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  11. GUARDDUTY (security)
# ═══════════════════════════════════════════════════════════════════════

class GuardDutyConfig(BaseModel):
    """Configuration required to enable AWS GuardDuty."""

    detector_name: str = Field(description="Descriptive name for the GuardDuty detector")
    enable: bool = Field(default=True, description="Enable the GuardDuty detector")
    finding_publishing_frequency: str = Field(
        default="FIFTEEN_MINUTES",
        description="Finding publishing frequency (FIFTEEN_MINUTES, ONE_HOUR, SIX_HOURS)",
    )
    s3_logs_enabled: bool = Field(default=True, description="Enable S3 data event monitoring")
    kubernetes_audit_logs_enabled: bool = Field(default=False, description="Enable EKS audit log monitoring")
    malware_protection_enabled: bool = Field(default=False, description="Enable malware scanning for EBS volumes")
    ebs_volumes_enabled: bool = Field(default=False, description="Enable EBS volume scanning")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  12. SECRETS MANAGER (secrets)
# ═══════════════════════════════════════════════════════════════════════

class SecretsManagerConfig(BaseModel):
    """Configuration required to create an AWS Secrets Manager secret."""

    secret_name: str = Field(description="Name of the secret (path format: /app/prod/db-password)")
    description: str = Field(default="", description="Description of the secret's purpose")
    kms_key_id: Optional[str] = Field(default=None, description="KMS key ID for encryption (uses AWS default key if empty)")
    secret_string: Optional[str] = Field(default=None, description="Initial secret value (JSON string recommended)")
    rotation_enabled: bool = Field(default=False, description="Enable automatic rotation")
    rotation_lambda_arn: Optional[str] = Field(default=None, description="Lambda ARN for rotation function")
    rotation_days: int = Field(default=30, description="Automatic rotation interval in days")
    recovery_window_days: int = Field(default=30, description="Recovery window in days after deletion (7-30)")
    replica_regions: list[str] = Field(default_factory=list, description="Regions to replicate the secret to")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  13. CLOUDWATCH (monitoring)
# ═══════════════════════════════════════════════════════════════════════

class CloudWatchConfig(BaseModel):
    """Configuration required to create AWS CloudWatch resources (log group + alarms)."""

    log_group_name: str = Field(description="CloudWatch log group name (e.g., /ecs/my-app)")
    retention_in_days: int = Field(default=30, description="Log retention period in days (1, 3, 5, 7, 14, 30, 60, 90, ...)")
    kms_key_id: Optional[str] = Field(default=None, description="KMS key ID for log group encryption")
    alarm_name: Optional[str] = Field(default=None, description="CloudWatch alarm name (empty if no alarm needed)")
    alarm_metric_name: Optional[str] = Field(default=None, description="Metric name to alarm on (e.g., CPUUtilization)")
    alarm_namespace: Optional[str] = Field(default=None, description="Metric namespace (e.g., AWS/EC2, AWS/RDS)")
    alarm_threshold: float = Field(default=80.0, description="Alarm threshold value")
    alarm_comparison_operator: str = Field(
        default="GreaterThanThreshold",
        description="Comparison operator for the alarm",
    )
    alarm_evaluation_periods: int = Field(default=2, description="Number of evaluation periods before triggering")
    alarm_period_seconds: int = Field(default=300, description="Evaluation period length in seconds")
    alarm_actions: list[str] = Field(default_factory=list, description="SNS topic ARNs to notify on alarm")
    dashboard_name: Optional[str] = Field(default=None, description="CloudWatch dashboard name (empty if not needed)")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  14. EVENTBRIDGE RULE (events)
# ═══════════════════════════════════════════════════════════════════════

class EventBridgeRuleConfig(BaseModel):
    """Configuration required to create an AWS EventBridge rule."""

    rule_name: str = Field(description="Name of the EventBridge rule")
    event_bus_name: str = Field(default="default", description="Event bus name (default or custom)")
    description: str = Field(default="", description="Description of the rule")
    schedule_expression: Optional[str] = Field(
        default=None,
        description="Schedule expression (e.g., 'rate(5 minutes)' or 'cron(0 12 * * ? *)')",
    )
    event_pattern: Optional[str] = Field(default=None, description="Event pattern JSON string for matching events")
    state: str = Field(default="ENABLED", description="Rule state (ENABLED or DISABLED)")
    target_arn: Optional[str] = Field(default=None, description="Target ARN (Lambda, SQS, SNS, etc.)")
    target_role_arn: Optional[str] = Field(default=None, description="IAM role ARN for EventBridge to invoke the target")
    target_input: Optional[str] = Field(default=None, description="Constant JSON input to pass to the target")
    retry_attempts: int = Field(default=2, description="Number of retry attempts (0-185)")
    maximum_event_age_seconds: int = Field(default=86400, description="Maximum event age in seconds before discarding")
    dead_letter_queue_arn: Optional[str] = Field(default=None, description="DLQ ARN for failed event deliveries")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  15. ALB — APPLICATION LOAD BALANCER (loadbalancer)
# ═══════════════════════════════════════════════════════════════════════

class ALBConfig(BaseModel):
    """Configuration required to create an AWS Application Load Balancer."""

    lb_name: str = Field(description="Name of the Application Load Balancer")
    lb_type: str = Field(default="application", description="Load balancer type (application or network)")
    scheme: str = Field(default="internet-facing", description="Scheme (internet-facing or internal)")
    subnet_ids: list[str] = Field(default_factory=list, description="Subnet IDs to place the ALB in (minimum 2 AZs)")
    security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs for the ALB")
    idle_timeout_seconds: int = Field(default=60, description="Idle timeout in seconds")
    enable_deletion_protection: bool = Field(default=False, description="Enable deletion protection")
    enable_access_logs: bool = Field(default=False, description="Enable access logging to S3")
    access_log_bucket: Optional[str] = Field(default=None, description="S3 bucket for access logs")
    target_group_name: Optional[str] = Field(default=None, description="Name of the target group")
    target_type: str = Field(default="ip", description="Target type (ip, instance, lambda, alb)")
    target_port: int = Field(default=80, description="Port that targets receive traffic on")
    target_protocol: str = Field(default="HTTP", description="Protocol for routing to targets (HTTP, HTTPS)")
    health_check_path: str = Field(default="/health", description="Health check path")
    health_check_interval_seconds: int = Field(default=30, description="Health check interval in seconds")
    listener_port: int = Field(default=443, description="Listener port (80 for HTTP, 443 for HTTPS)")
    listener_protocol: str = Field(default="HTTPS", description="Listener protocol (HTTP or HTTPS)")
    acm_certificate_arn: Optional[str] = Field(default=None, description="ACM certificate ARN for HTTPS listener")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  16. ROUTE53 (dns)
# ═══════════════════════════════════════════════════════════════════════

class Route53Config(BaseModel):
    """Configuration required to create an AWS Route53 hosted zone and records."""

    hosted_zone_name: str = Field(description="Domain name for the hosted zone (e.g., example.com)")
    is_private_zone: bool = Field(default=False, description="Create as a private hosted zone")
    vpc_id: Optional[str] = Field(default=None, description="VPC ID to associate with private hosted zone")
    record_name: Optional[str] = Field(default=None, description="DNS record name (e.g., app.example.com)")
    record_type: str = Field(default="A", description="DNS record type (A, AAAA, CNAME, MX, TXT, etc.)")
    record_ttl: int = Field(default=300, description="Time to live for the DNS record in seconds")
    record_values: list[str] = Field(default_factory=list, description="Record values (IP addresses, CNAME targets, etc.)")
    alias_target_dns_name: Optional[str] = Field(default=None, description="Alias target DNS name (for ALB, CloudFront, etc.)")
    alias_target_hosted_zone_id: Optional[str] = Field(default=None, description="Alias target hosted zone ID")
    routing_policy: str = Field(default="simple", description="Routing policy (simple, weighted, latency, failover, geolocation)")
    health_check_enabled: bool = Field(default=False, description="Enable Route53 health check for this record")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  17. DYNAMODB TABLE (database — alternative)
# ═══════════════════════════════════════════════════════════════════════

class DynamoDBTableConfig(BaseModel):
    """Configuration required to create an AWS DynamoDB table."""

    table_name: str = Field(description="Name of the DynamoDB table")
    partition_key_name: str = Field(description="Partition (hash) key attribute name")
    partition_key_type: str = Field(default="S", description="Partition key type (S=String, N=Number, B=Binary)")
    sort_key_name: Optional[str] = Field(default=None, description="Sort (range) key attribute name")
    sort_key_type: Optional[str] = Field(default=None, description="Sort key type (S=String, N=Number, B=Binary)")
    billing_mode: str = Field(default="PAY_PER_REQUEST", description="Billing mode (PAY_PER_REQUEST or PROVISIONED)")
    read_capacity_units: int = Field(default=5, description="Provisioned read capacity units (only for PROVISIONED mode)")
    write_capacity_units: int = Field(default=5, description="Provisioned write capacity units (only for PROVISIONED mode)")
    enable_point_in_time_recovery: bool = Field(default=True, description="Enable point-in-time recovery backups")
    enable_encryption: bool = Field(default=True, description="Enable server-side encryption")
    kms_key_arn: Optional[str] = Field(default=None, description="KMS key ARN for encryption (uses AWS owned key if empty)")
    stream_enabled: bool = Field(default=False, description="Enable DynamoDB Streams")
    stream_view_type: Optional[str] = Field(
        default=None,
        description="Stream view type (NEW_IMAGE, OLD_IMAGE, NEW_AND_OLD_IMAGES, KEYS_ONLY)",
    )
    ttl_attribute_name: Optional[str] = Field(default=None, description="TTL attribute name for automatic item expiry")
    global_secondary_indexes: list[dict[str, str]] = Field(
        default_factory=list,
        description="Global secondary indexes [{name, partition_key, sort_key}]",
    )
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  18. SNS TOPIC (queue — alternative)
# ═══════════════════════════════════════════════════════════════════════

class SNSTopicConfig(BaseModel):
    """Configuration required to create an AWS SNS topic."""

    topic_name: str = Field(description="Name of the SNS topic")
    display_name: Optional[str] = Field(default=None, description="Display name for SMS and email subscriptions")
    fifo_topic: bool = Field(default=False, description="Create as FIFO topic (exactly-once message delivery)")
    content_based_deduplication: bool = Field(default=False, description="Enable content-based deduplication (FIFO only)")
    kms_master_key_id: Optional[str] = Field(default=None, description="KMS key ID for encryption")
    delivery_policy_http_max_retries: int = Field(default=3, description="Max HTTP delivery retries")
    subscription_protocols: list[str] = Field(
        default_factory=list,
        description="Subscription protocols (email, sqs, lambda, https, sms)",
    )
    subscription_endpoints: list[str] = Field(
        default_factory=list,
        description="Subscription endpoints (email addresses, SQS ARNs, Lambda ARNs, etc.)",
    )
    filter_policy: Optional[str] = Field(default=None, description="Message filter policy JSON string")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  19. EKS CLUSTER (container — alternative)
# ═══════════════════════════════════════════════════════════════════════

class EKSClusterConfig(BaseModel):
    """Configuration required to create an AWS EKS Kubernetes cluster."""

    cluster_name: str = Field(description="Name of the EKS cluster")
    kubernetes_version: str = Field(default="1.30", description="Kubernetes version (e.g., 1.29, 1.30)")
    cluster_role_arn: Optional[str] = Field(default=None, description="IAM role ARN for the EKS cluster")
    subnet_ids: list[str] = Field(default_factory=list, description="Subnet IDs for the EKS cluster (at least 2 AZs)")
    security_group_ids: list[str] = Field(default_factory=list, description="Security group IDs for the cluster")
    endpoint_public_access: bool = Field(default=True, description="Enable public access to the API server endpoint")
    endpoint_private_access: bool = Field(default=True, description="Enable private access to the API server endpoint")
    public_access_cidrs: list[str] = Field(
        default_factory=lambda: ["0.0.0.0/0"],
        description="CIDR blocks allowed for public API server access",
    )
    node_group_name: Optional[str] = Field(default=None, description="Managed node group name")
    node_instance_types: list[str] = Field(
        default_factory=lambda: ["t3.medium"],
        description="EC2 instance types for the node group",
    )
    node_min_size: int = Field(default=1, description="Minimum number of nodes in the node group")
    node_max_size: int = Field(default=3, description="Maximum number of nodes in the node group")
    node_desired_size: int = Field(default=2, description="Desired number of nodes in the node group")
    node_disk_size_gb: int = Field(default=20, description="EBS volume size for nodes in GB")
    node_ami_type: str = Field(default="AL2_x86_64", description="Node AMI type (AL2_x86_64, AL2_ARM_64, BOTTLEROCKET_x86_64)")
    enable_cluster_logging: bool = Field(default=True, description="Enable EKS control plane logging")
    log_types: list[str] = Field(
        default_factory=lambda: ["api", "audit", "authenticator"],
        description="Control plane log types to enable",
    )
    enable_secrets_encryption: bool = Field(default=False, description="Enable envelope encryption for Kubernetes Secrets")
    kms_key_arn: Optional[str] = Field(default=None, description="KMS key ARN for Secrets encryption")
    tags: dict[str, str] = Field(default_factory=dict, description="AWS resource tags")


# ═══════════════════════════════════════════════════════════════════════
#  AWS CONFIG REGISTRY — Maps ResourceType → primary AWS config class
# ═══════════════════════════════════════════════════════════════════════

AWS_CONFIG_REGISTRY: dict[ResourceType, type[BaseModel]] = {
    ResourceType.NETWORK:       VPCConfig,
    ResourceType.COMPUTE:       EC2InstanceConfig,
    ResourceType.SERVERLESS:    LambdaFunctionConfig,
    ResourceType.DATABASE:      RDSInstanceConfig,
    ResourceType.STORAGE:       S3BucketConfig,
    ResourceType.APIGATEWAY:    APIGatewayConfig,
    ResourceType.CACHE:         ElastiCacheConfig,
    ResourceType.CONTAINER:     ECSFargateConfig,
    ResourceType.QUEUE:         SQSQueueConfig,
    ResourceType.CDN:           CloudFrontDistributionConfig,
    ResourceType.SECURITY:      GuardDutyConfig,
    ResourceType.SECRETS:       SecretsManagerConfig,
    ResourceType.MONITORING:    CloudWatchConfig,
    ResourceType.EVENTS:        EventBridgeRuleConfig,
    ResourceType.LOADBALANCER:  ALBConfig,
    ResourceType.DNS:           Route53Config,
}

# ═══════════════════════════════════════════════════════════════════════
#  AWS CONFIG ALTERNATIVES — Sub-type variants for existing types
#  Used when the planner detects a specific AWS service (e.g., DynamoDB
#  instead of RDS for the "database" resource type).
# ═══════════════════════════════════════════════════════════════════════

AWS_CONFIG_ALTERNATIVES: dict[ResourceType, dict[str, type[BaseModel]]] = {
    ResourceType.DATABASE: {
        "RDS":      RDSInstanceConfig,
        "DynamoDB": DynamoDBTableConfig,
    },
    ResourceType.QUEUE: {
        "SQS": SQSQueueConfig,
        "SNS": SNSTopicConfig,
    },
    ResourceType.CONTAINER: {
        "ECS-Fargate": ECSFargateConfig,
        "EKS":         EKSClusterConfig,
    },
}
