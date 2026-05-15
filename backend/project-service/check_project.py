"""Quick script to check project data in MongoDB."""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    db = client["devops_poc"]
    
    print("=== user_projects collection ===")
    count = await db.user_projects.count_documents({})
    print(f"Total documents: {count}\n")
    
    async for doc in db.user_projects.find():
        print(f"  _id: {doc.get('_id')}")
        print(f"  project_name: {doc.get('project_name')}")
        print(f"  owner_username: {doc.get('owner_username')}")
        print(f"  domain: {repr(doc.get('domain'))}")
        print(f"  platform: {repr(doc.get('platform'))}")
        print(f"  cloud_provider: {repr(doc.get('cloud_provider'))}")
        print(f"  region: {repr(doc.get('region'))}")
        print(f"  iam_name: {repr(doc.get('iam_name'))}")
        print(f"  environment: {repr(doc.get('environment'))}")
        print(f"  expected_traffic: {repr(doc.get('expected_traffic'))}")
        print(f"  cost_preference: {repr(doc.get('cost_preference'))}")
        print(f"  --- all keys: {list(doc.keys())}")
        print()
    
    client.close()

asyncio.run(main())
