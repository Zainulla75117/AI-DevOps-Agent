from typing import List, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId
from datetime import datetime
from app.models.user import User
from app.schemas.user import UserCreate

async def create_user(db: AsyncIOMotorDatabase, user: UserCreate) -> User:
    """
    Create a new user in the database.
    
    Args:
        db: MongoDB database instance
        user: UserCreate schema with user data
        
    Returns:
        Created User model
    """
    try:
        from app.config import settings
        
        user_dict = user.model_dump()
        user_dict["created_at"] = datetime.utcnow()
        user_dict["is_active"] = True
        
        print(f"📝 Attempting to insert user into database: {settings.DATABASE_NAME}")
        print(f"📝 Collection name: users")
        print(f"📝 User data: {user_dict}")
        
        # Insert into the users collection
        result = await db.users.insert_one(user_dict)
        
        print(f"📝 Insert result: {result.inserted_id}")
        print(f"📝 Acknowledged: {result.acknowledged}")
        
        if not result.inserted_id:
            raise Exception("Failed to insert user - no inserted_id returned")
        
        # Verify the insert by finding the document
        created_user = await db.users.find_one({"_id": result.inserted_id})
        
        if not created_user:
            raise Exception(f"User inserted but not found with id: {result.inserted_id}")
        
        # Verify document count
        count = await db.users.count_documents({})
        print(f"✅ User created successfully with ID: {result.inserted_id}")
        print(f"✅ Total documents in collection: {count}")
        print(f"✅ Database: {settings.DATABASE_NAME}, Collection: users")
        
        return User(**created_user)
    except Exception as e:
        print(f"❌ Error creating user: {e}")
        print(f"❌ User data: {user_dict}")
        import traceback
        traceback.print_exc()
        raise

async def get_user(db: AsyncIOMotorDatabase, user_id: str) -> Optional[User]:
    """
    Get a user by ID.
    
    Args:
        db: MongoDB database instance
        user_id: User ID as string
        
    Returns:
        User model if found, None otherwise
    """
    if not ObjectId.is_valid(user_id):
        return None
    
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if user:
        return User(**user)
    return None

async def get_user_by_username(db: AsyncIOMotorDatabase, username: str) -> Optional[User]:
    """
    Get a user by username.
    
    Args:
        db: MongoDB database instance
        username: Username to search for
        
    Returns:
        User model if found, None otherwise
    """
    user = await db.users.find_one({"username": username})
    if user:
        return User(**user)
    return None

async def get_all_users(db: AsyncIOMotorDatabase, skip: int = 0, limit: int = 100) -> List[User]:
    """
    Get all users with pagination.
    
    Args:
        db: MongoDB database instance
        skip: Number of documents to skip
        limit: Maximum number of documents to return
        
    Returns:
        List of User models
    """
    cursor = db.users.find().skip(skip).limit(limit)
    users = await cursor.to_list(length=limit)
    return [User(**user) for user in users]

async def update_user(db: AsyncIOMotorDatabase, user_id: str, user_update: dict) -> Optional[User]:
    """
    Update a user by ID.
    
    Args:
        db: MongoDB database instance
        user_id: User ID as string
        user_update: Dictionary with fields to update
        
    Returns:
        Updated User model if found, None otherwise
    """
    if not ObjectId.is_valid(user_id):
        return None
    
    user_update["updated_at"] = datetime.utcnow()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": user_update}
    )
    
    if result.modified_count:
        updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
        if updated_user:
            return User(**updated_user)
    return None

async def delete_user(db: AsyncIOMotorDatabase, user_id: str) -> bool:
    """
    Delete a user by ID.
    
    Args:
        db: MongoDB database instance
        user_id: User ID as string
        
    Returns:
        True if user was deleted, False otherwise
    """
    if not ObjectId.is_valid(user_id):
        return False
    
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    return result.deleted_count > 0


async def get_or_create_github_user(
    db: AsyncIOMotorDatabase,
    github_id: int,
    username: str,
    email: str,
    avatar_url: str,
) -> User:
    """
    Find an existing user by GitHub ID, or create a new one.
    Updates profile info (avatar, email) on each login.
    
    Args:
        db: MongoDB database instance
        github_id: GitHub user ID (numeric)
        username: GitHub login name
        email: GitHub email
        avatar_url: GitHub avatar URL
        
    Returns:
        User model (existing or newly created)
    """
    # 1. Try to find by github_id
    existing = await db.users.find_one({"github_id": github_id})
    if existing:
        # Update profile info on each login
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "avatar_url": avatar_url,
                "email": email or existing.get("email"),
                "updated_at": datetime.utcnow(),
            }}
        )
        updated = await db.users.find_one({"_id": existing["_id"]})
        print(f"✅ GitHub user found and updated: {username} (github_id={github_id})")
        return User(**updated)

    # 2. Check for username collision with local users
    final_username = username
    collision = await db.users.find_one({"username": username})
    if collision:
        final_username = f"{username}_gh"
        print(f"⚠️ Username '{username}' taken, using '{final_username}' for GitHub user")

    # 3. Create new user
    user_dict = {
        "username": final_username,
        "password": None,
        "email": email,
        "avatar_url": avatar_url,
        "github_id": github_id,
        "auth_provider": "github",
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_dict)
    created = await db.users.find_one({"_id": result.inserted_id})
    print(f"✅ GitHub user created: {final_username} (github_id={github_id})")
    return User(**created)


async def get_or_create_google_user(
    db: AsyncIOMotorDatabase,
    google_id: str,
    username: str,
    email: str,
    avatar_url: str,
) -> User:
    """
    Find an existing user by Google ID, or create a new one.
    Updates profile info (avatar, email) on each login.
    
    Args:
        db: MongoDB database instance
        google_id: Google 'sub' claim (string)
        username: Display name from Google
        email: Google email
        avatar_url: Google profile picture URL
        
    Returns:
        User model (existing or newly created)
    """
    # 1. Try to find by google_id
    existing = await db.users.find_one({"google_id": google_id})
    if existing:
        await db.users.update_one(
            {"_id": existing["_id"]},
            {"$set": {
                "avatar_url": avatar_url,
                "email": email or existing.get("email"),
                "updated_at": datetime.utcnow(),
            }}
        )
        updated = await db.users.find_one({"_id": existing["_id"]})
        print(f"✅ Google user found and updated: {username} (google_id={google_id})")
        return User(**updated)

    # 2. Check for username collision
    final_username = username
    collision = await db.users.find_one({"username": username})
    if collision:
        # Use email prefix as fallback username
        email_prefix = email.split("@")[0] if email else username
        final_username = f"{email_prefix}_google"
        print(f"⚠️ Username '{username}' taken, using '{final_username}' for Google user")

    # 3. Create new user
    user_dict = {
        "username": final_username,
        "password": None,
        "email": email,
        "avatar_url": avatar_url,
        "google_id": google_id,
        "auth_provider": "google",
        "is_active": True,
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_dict)
    created = await db.users.find_one({"_id": result.inserted_id})
    print(f"✅ Google user created: {final_username} (google_id={google_id})")
    return User(**created)
