# SCM Knowledge DB Implementation Notes

## Architecture Changes
We replaced the old "raw text dump" approach for repository context with a structured, queryable Knowledge Database.

### 1. Deterministic Analyzer (`scm-service/app/services/repo_analyzer.py`)
- We added a deterministic parser that runs on the repository ZIP file after download.
- It detects languages, categorizes dependencies (e.g., `sqlalchemy` -> `database`), extracts infrastructure signals (Dockerfile, CI/CD), and classifies the architecture (monolith, microservice, etc.).
- It extracts the full text of infra-relevant files only (Dockerfile, terraform files, CI/CD, etc.) instead of passing all files blindly.

### 2. Qdrant Vector Search (`scm-service/app/services/qdrant_service.py`)
- We integrated Qdrant using the local fastembed engine (`qdrant-client[fastembed]`).
- The structured analysis is broken into chunks (dependencies, infra files, tech stack summary, dir summary) and embedded into the `scm_repo_context` collection.
- This allows semantic search of the repository context later.

### 3. MongoDB Storage (`scm-service/app/crud/repo_analysis.py`)
- The full structured analysis is saved in MongoDB (`repo_analyses` collection) to prevent re-parsing the repo every session.

### 4. Smart Context Builder (`infrastructure-service/chat/context_builder.py`)
- The `planner.py` node was refactored to use `build_repo_context`.
- It fetches the structured analysis from the `scm-service` (`GET /api/scm/repos/{id}/analysis`).
- It performs a semantic search against Qdrant using the user's prompt to pull in relevant chunks.
- If the structured analysis isn't ready yet, it falls back to the old raw `repo_tree` logic.

### 5. Seamless Onboarding (`infrastructure-service/app/services/session_manager.py`)
- The `SessionManager` now checks if an analysis exists. If not, it triggers a background analysis (`POST /api/scm/repos/{id}/analyze`) and fetches the raw tree as a temporary fallback for the current session.

## Next Steps / Future Work
- Add webhooks from GitHub/GitLab to automatically trigger `POST /analyze` when the default branch is updated, keeping the analysis fresh without user intervention.
- Use the Qdrant semantic search in other nodes (e.g., a "QA node" that answers questions about the codebase).
