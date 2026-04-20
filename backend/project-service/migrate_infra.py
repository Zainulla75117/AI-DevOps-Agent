"""
Infrastructure Schema Migration Script
=======================================
Migrates documents from the legacy per-type collections:
  - network_infra     → type: "network"
  - servers_infra     → type: "compute"
  - serverless_infra  → type: "serverless"
  - cloud_managed_infra → type: "database"

Into the unified `infra_resources` collection with version snapshots
in `infra_versions`.

Usage:
    python migrate_infra.py

Requirements:
    - MongoDB must be running and accessible
    - The `user_projects` collection must contain project documents
      so that project_name → project_id resolution works

Safety:
    - This script does NOT drop old collections.
    - It is idempotent — running it twice will insert duplicates unless
      you clear `infra_resources` first.
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
from datetime import datetime
from app.config import settings


async def run_migration():
    print("=" * 70)
    print("  InfraX Schema Migration — Legacy → infra_resources")
    print("=" * 70)

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]

    # ── Step 1: Build project_name → project_id lookup ────────────────
    print("\n📋 Building project_name → project_id mapping...")
    project_map = {}
    async for project in db.user_projects.find({}, {"_id": 1, "project_name": 1, "cloud_provider": 1, "region": 1, "environment": 1}):
        project_map[project["project_name"]] = {
            "project_id": project["_id"],
            "provider": (project.get("cloud_provider") or "aws").lower(),
            "region": project.get("region") or "us-east-1",
            "env": (project.get("environment") or "dev").lower(),
        }
    print(f"   Found {len(project_map)} projects")

    # ── Step 2: Migrate each legacy collection ────────────────────────
    stats = {"total": 0, "migrated": 0, "orphaned": 0, "versions_created": 0}

    async def migrate_collection(collection_name: str, resource_type: str, config_extractor):
        """Generic migration function for any legacy collection."""
        print(f"\n🔄 Migrating {collection_name} → type: \"{resource_type}\"")
        count = 0
        async for doc in db[collection_name].find({}):
            stats["total"] += 1
            project_name = doc.get("project_name", "")
            project_info = project_map.get(project_name)

            if not project_info:
                print(f"   ⚠️  Orphan: project_name='{project_name}' not found in user_projects (migrating with project_id=null)")
                stats["orphaned"] += 1

            now = datetime.utcnow()
            config = config_extractor(doc)
            name = _derive_name(doc, resource_type)

            resource_doc = {
                "project_id": project_info["project_id"] if project_info else None,
                "type": resource_type,
                "name": name,
                "provider": project_info["provider"] if project_info else "aws",
                "region": project_info["region"] if project_info else "us-east-1",
                "env": project_info["env"] if project_info else "dev",
                "config": config,
                "actual_state": None,
                "state": "provisioned",
                "version": 1,
                "depends_on": [],
                "created_at": doc.get("created_at", now),
                "updated_at": doc.get("created_at", now),
                "last_applied_at": None,
                "last_applied_by": None,
            }

            result = await db.infra_resources.insert_one(resource_doc)
            resource_id = result.inserted_id

            # Create version 1 snapshot
            version_doc = {
                "resource_id": resource_id,
                "version": 1,
                "config": config,
                "changed_by": "migration-script",
                "change_reason": f"Migrated from legacy collection: {collection_name}",
                "created_at": doc.get("created_at", now),
            }
            await db.infra_versions.insert_one(version_doc)

            stats["migrated"] += 1
            stats["versions_created"] += 1
            count += 1

        print(f"   ✅ Migrated {count} documents from {collection_name}")

    def _derive_name(doc, resource_type):
        """Derive a human-readable name from legacy doc fields."""
        if resource_type == "network":
            return doc.get("vpc_name", "unnamed-vpc")
        elif resource_type == "compute":
            return f"{doc.get('os_image', 'server')}-{doc.get('instance_type', 'unknown')}"
        elif resource_type == "serverless":
            return doc.get("handler", "unnamed-function").split(".")[0]
        elif resource_type == "database":
            return doc.get("service_name") or f"{doc.get('service_type', 'service')}-instance"
        return f"{resource_type}-resource"

    # ── network_infra ─────────────────────────────────────────────────
    def extract_network_config(doc):
        return {
            "vpc_name": doc.get("vpc_name"),
            "vpc_cidr": doc.get("vpc_cidr"),
            "nat_gateway": doc.get("nat_gateway"),
            "public_subnet_count": doc.get("public_subnet_count"),
            "private_subnet_count": doc.get("private_subnet_count"),
            "availability_zones_count": doc.get("availability_zones_count"),
            "nat_gateway_az_count": doc.get("nat_gateway_az_count", 0),
            "enable_dns_hostnames": doc.get("enable_dns_hostnames", True),
            "enable_dns_support": doc.get("enable_dns_support", True),
        }

    await migrate_collection("network_infra", "network", extract_network_config)

    # ── servers_infra ─────────────────────────────────────────────────
    def extract_compute_config(doc):
        config = {
            "instance_type": doc.get("instance_type"),
            "instance_count": doc.get("instance_count"),
            "os_image": doc.get("os_image"),
            "storage_size": doc.get("storage_size"),
        }
        # Security: Move key_pair_name to secret_ref
        key_pair = doc.get("key_pair_name")
        if key_pair:
            config["secret_ref"] = f"aws-secrets-manager/keypair-{key_pair}"
        return config

    await migrate_collection("servers_infra", "compute", extract_compute_config)

    # ── serverless_infra ──────────────────────────────────────────────
    def extract_serverless_config(doc):
        return {
            "runtime": doc.get("runtime"),
            "memory_size": doc.get("memory_size"),
            "timeout": doc.get("timeout"),
            "handler": doc.get("handler"),
            "description": doc.get("description"),
        }

    await migrate_collection("serverless_infra", "serverless", extract_serverless_config)

    # ── cloud_managed_infra ───────────────────────────────────────────
    def extract_database_config(doc):
        return {
            "service_type": doc.get("service_type"),
            "instance_class": doc.get("instance_class"),
            "storage_size": doc.get("storage_size"),
            "service_name": doc.get("service_name"),
        }

    await migrate_collection("cloud_managed_infra", "database", extract_database_config)

    # ── Step 3: Create indexes ────────────────────────────────────────
    print("\n📊 Creating indexes...")
    await db.infra_resources.create_index([("project_id", 1), ("env", 1)], name="idx_project_env")
    await db.infra_resources.create_index([("type", 1)], name="idx_type")
    await db.infra_resources.create_index([("project_id", 1), ("type", 1)], name="idx_project_type")
    await db.infra_resources.create_index([("state", 1)], name="idx_state")
    await db.infra_versions.create_index([("resource_id", 1), ("version", -1)], name="idx_resource_version")
    await db.infra_executions.create_index([("project_id", 1), ("started_at", -1)], name="idx_project_executions")
    await db.infra_executions.create_index([("execution_id", 1)], name="idx_execution_id", unique=True)
    print("   ✅ All indexes created")

    # ── Summary ───────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("  Migration Summary")
    print("=" * 70)
    print(f"  Total legacy documents scanned:  {stats['total']}")
    print(f"  Successfully migrated:           {stats['migrated']}")
    print(f"  Version snapshots created:       {stats['versions_created']}")
    print(f"  Orphaned (project_id=null):      {stats['orphaned']}")
    print(f"\n  ⚠️  Old collections were NOT dropped.")
    print(f"  After verifying the migration, you can manually drop:")
    print(f"     db.network_infra.drop()")
    print(f"     db.servers_infra.drop()")
    print(f"     db.serverless_infra.drop()")
    print(f"     db.cloud_managed_infra.drop()")
    print("=" * 70)

    client.close()


if __name__ == "__main__":
    asyncio.run(run_migration())
