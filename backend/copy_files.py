"""
IMPORTANT: Run this script manually to complete the credential-service setup!

From the project root, run:
  python backend/copy_files.py

This copies all router/crud/model/schema/service files from auth-service
to credential-service (they share the same code for these modules).
"""
import shutil
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SCRIPT_DIR, "auth-service", "app")
DST = os.path.join(SCRIPT_DIR, "credential-service", "app")

copies = [
    # Routers
    ("routers/scm.py", "routers/scm.py"),
    ("routers/scm_repo.py", "routers/scm_repo.py"),
    ("routers/jenkins_credentials.py", "routers/jenkins_credentials.py"),
    # CRUD
    ("crud/scm.py", "crud/scm.py"),
    ("crud/scm_repo.py", "crud/scm_repo.py"),
    ("crud/jenkins_credentials.py", "crud/jenkins_credentials.py"),
    ("crud/jenkins_data.py", "crud/jenkins_data.py"),
    # Models (user.py already created manually)
    ("models/scm.py", "models/scm.py"),
    ("models/scm_repo.py", "models/scm_repo.py"),
    ("models/jenkins_credentials.py", "models/jenkins_credentials.py"),
    ("models/jenkins_data.py", "models/jenkins_data.py"),
    # Schemas
    ("schemas/scm.py", "schemas/scm.py"),
    ("schemas/scm_repo.py", "schemas/scm_repo.py"),
    ("schemas/jenkins_credentials.py", "schemas/jenkins_credentials.py"),
    ("schemas/jenkins_data.py", "schemas/jenkins_data.py"),
    # Services
    ("services/scm_service.py", "services/scm_service.py"),
    ("services/jenkins_service.py", "services/jenkins_service.py"),
]

print("=" * 60)
print("Credential Service - File Copy Script")
print("=" * 60)
print(f"Source: {SRC}")
print(f"Target: {DST}")
print()

copied = 0
for src_rel, dst_rel in copies:
    src = os.path.join(SRC, src_rel)
    dst = os.path.join(DST, dst_rel)
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    
    if not os.path.exists(src):
        print(f"⚠️  SKIP (not found): {src_rel}")
        continue
    
    shutil.copy2(src, dst)
    copied += 1
    print(f"✅ Copied: {src_rel}")

print()
print(f"✅ Done! Copied {copied}/{len(copies)} files to credential-service.")
print()
print("Next step: Create venvs for each service:")
print("  cd backend/api-gateway && python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt")
print("  cd backend/project-service && python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt")
print("  cd backend/credential-service && python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt")
