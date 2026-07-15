"""
Repo Analyzer Pipeline — Deterministic repository analysis.

Parses repository files to produce a structured understanding of:
  - Languages & frameworks
  - Dependencies (categorized, infra-relevance flagged)
  - Infrastructure signals (Dockerfile, CI/CD, Terraform, etc.)
  - Architecture classification
  - Directory structure summary

No LLM required — this is pure deterministic parsing.
"""

import os
import re
import json
import hashlib
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime

# ═══════════════════════════════════════════════════════════════════════
#  CONSTANTS & MAPPINGS
# ═══════════════════════════════════════════════════════════════════════

EXTENSION_LANGUAGE_MAP = {
    ".py": "python", ".pyw": "python",
    ".js": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".ts": "typescript", ".mts": "typescript",
    ".jsx": "javascript", ".tsx": "typescript",
    ".java": "java",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".c": "c", ".h": "c",
    ".swift": "swift",
    ".kt": "kotlin", ".kts": "kotlin",
    ".scala": "scala",
    ".dart": "dart",
    ".lua": "lua",
    ".r": "r", ".R": "r",
    ".vue": "vue",
    ".svelte": "svelte",
}

# Maps a dependency name → infra category
# Only infra-relevant categories are flagged
DEPENDENCY_CATEGORY_MAP: Dict[str, str] = {}

_CATEGORY_KEYWORDS = {
    "database": [
        "pg", "postgres", "postgresql", "mysql", "mysql2", "mongoose", "mongodb",
        "mongo", "prisma", "sequelize", "typeorm", "sqlalchemy", "psycopg2",
        "psycopg", "pymongo", "knex", "drizzle", "mikro-orm", "mariadb",
        "sqlite3", "better-sqlite3", "peewee", "tortoise-orm", "databases",
        "asyncpg", "aiomysql", "motor", "diesel", "sqlx", "gorm",
        "spring-boot-starter-data-jpa", "hibernate-core", "exposed",
        "doobie", "slick", "alembic", "flyway", "liquibase",
    ],
    "cache": [
        "redis", "ioredis", "memcached", "pymemcache", "django-redis",
        "bull", "bullmq", "aioredis", "keydb", "cacheman",
    ],
    "queue": [
        "amqplib", "amqp", "sqs-consumer", "@aws-sdk/client-sqs",
        "celery", "rabbitmq", "pika", "kafka", "kafkajs", "confluent-kafka",
        "@aws-sdk/client-sns", "kombu", "rq", "huey", "dramatiq",
    ],
    "storage": [
        "@aws-sdk/client-s3", "multer-s3", "boto3", "minio",
        "@google-cloud/storage", "azure-storage-blob",
    ],
    "web_framework": [
        "express", "fastapi", "flask", "django", "tornado", "koa",
        "hapi", "@nestjs/core", "gin", "fiber", "echo",
        "spring-boot-starter-web", "rails", "actix-web", "rocket",
        "aiohttp", "sanic", "starlette", "litestar",
    ],
    "frontend": [
        "react", "react-dom", "vue", "@angular/core", "next", "nuxt",
        "svelte", "gatsby", "vite", "@vue/cli", "solid-js", "qwik",
    ],
    "auth": [
        "passport", "jsonwebtoken", "bcrypt", "argon2",
        "python-jose", "PyJWT", "django-allauth",
        "next-auth", "@auth0/nextjs-auth0", "clerk",
    ],
    "monitoring": [
        "prometheus-client", "prom-client", "@sentry/node", "sentry-sdk",
        "opentelemetry-api", "@opentelemetry/api", "datadog", "newrelic",
    ],
    "serverless": [
        "serverless", "@aws-sdk/client-lambda", "chalice", "zappa",
        "aws-cdk-lib", "sst",
    ],
}

# Build the flat lookup map
for _category, _keywords in _CATEGORY_KEYWORDS.items():
    for _kw in _keywords:
        DEPENDENCY_CATEGORY_MAP[_kw.lower()] = _category

INFRA_RELEVANT_CATEGORIES = {"database", "cache", "queue", "storage", "monitoring", "serverless"}

EXCLUDED_DIRS = {
    "node_modules", "venv", ".venv", "dist", "build", ".git", ".idea",
    "__pycache__", ".tox", ".mypy_cache", ".pytest_cache", "target",
    "vendor", "bower_components", ".next", ".nuxt", "coverage",
    ".terraform", ".serverless", "egg-info",
}

# Exact filename → infra file type
INFRA_FILE_NAMES = {
    "Dockerfile": "dockerfile",
    "dockerfile": "dockerfile",
    "docker-compose.yml": "docker_compose",
    "docker-compose.yaml": "docker_compose",
    "compose.yml": "docker_compose",
    "compose.yaml": "docker_compose",
    "Jenkinsfile": "ci_cd",
    "Makefile": "build_config",
    ".env.example": "env_template",
    ".env.template": "env_template",
    ".env.sample": "env_template",
    "sonar-project.properties": "quality_config",
    "nginx.conf": "server_config",
    "Procfile": "deployment",
    "app.yaml": "deployment",
    "serverless.yml": "serverless",
    "serverless.yaml": "serverless",
    "package.json": "dependency_manifest",
    "requirements.txt": "dependency_manifest",
    "pyproject.toml": "dependency_manifest",
    "Pipfile": "dependency_manifest",
    "go.mod": "dependency_manifest",
    "pom.xml": "dependency_manifest",
    "build.gradle": "dependency_manifest",
    "Cargo.toml": "dependency_manifest",
    "Gemfile": "dependency_manifest",
    "composer.json": "dependency_manifest",
}

# Extension → infra file type
INFRA_FILE_EXTENSIONS = {
    ".tf": "terraform",
    ".tfvars": "terraform",
}

# Directory names that indicate CI/CD or infra
INFRA_DIR_INDICATORS = {
    ".github/workflows": "github_actions",
    ".gitlab-ci.yml": "gitlab_ci",
    ".circleci": "circleci",
    "k8s": "kubernetes",
    "kubernetes": "kubernetes",
    "helm": "helm",
    "terraform": "terraform",
    "infra": "infrastructure",
    "deploy": "deployment",
    "cdk": "aws_cdk",
}

# Framework detection: language → {framework_name: [dep indicators]}
FRAMEWORK_INDICATORS = {
    "python": {
        "FastAPI": ["fastapi"],
        "Django": ["django"],
        "Flask": ["flask"],
        "Tornado": ["tornado"],
        "Sanic": ["sanic"],
        "aiohttp": ["aiohttp"],
    },
    "javascript": {
        "Express": ["express"],
        "React": ["react", "react-dom"],
        "Next.js": ["next"],
        "Vue.js": ["vue"],
        "Nuxt": ["nuxt"],
        "Angular": ["@angular/core"],
        "NestJS": ["@nestjs/core"],
        "Svelte": ["svelte"],
        "Gatsby": ["gatsby"],
    },
    "typescript": {
        "Express": ["express"],
        "NestJS": ["@nestjs/core"],
        "Next.js": ["next"],
        "React": ["react"],
        "Angular": ["@angular/core"],
    },
    "java": {
        "Spring Boot": ["spring-boot-starter-web", "spring-boot"],
    },
    "go": {
        "Gin": ["github.com/gin-gonic/gin"],
        "Echo": ["github.com/labstack/echo"],
        "Fiber": ["github.com/gofiber/fiber"],
    },
    "rust": {
        "Actix Web": ["actix-web"],
        "Rocket": ["rocket"],
        "Axum": ["axum"],
    },
}


# ═══════════════════════════════════════════════════════════════════════
#  DEPENDENCY PARSERS
# ═══════════════════════════════════════════════════════════════════════

def _parse_package_json(content: str) -> List[Dict[str, Any]]:
    """Parse package.json into dependency list."""
    deps = []
    try:
        data = json.loads(content)
        for dep_key, dep_type in [
            ("dependencies", "production"),
            ("devDependencies", "dev"),
            ("peerDependencies", "peer"),
            ("optionalDependencies", "optional"),
        ]:
            for name, version in (data.get(dep_key) or {}).items():
                category = _categorize_dependency(name)
                deps.append({
                    "name": name,
                    "version": str(version),
                    "dep_type": dep_type,
                    "category": category,
                    "infra_relevant": category in INFRA_RELEVANT_CATEGORIES,
                })
    except (json.JSONDecodeError, TypeError):
        pass
    return deps


def _parse_requirements_txt(content: str) -> List[Dict[str, Any]]:
    """Parse requirements.txt into dependency list."""
    deps = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        # Handle: package==1.0, package>=1.0, package~=1.0, package
        match = re.match(r"^([a-zA-Z0-9_\-\.]+)\s*([><=~!]+\s*[\d\.\*]+)?", line)
        if match:
            name = match.group(1).lower()
            version = (match.group(2) or "").strip()
            category = _categorize_dependency(name)
            deps.append({
                "name": name,
                "version": version,
                "dep_type": "production",
                "category": category,
                "infra_relevant": category in INFRA_RELEVANT_CATEGORIES,
            })
    return deps


def _parse_pyproject_toml(content: str) -> List[Dict[str, Any]]:
    """Parse pyproject.toml into dependency list."""
    deps = []
    try:
        try:
            import tomllib
        except ImportError:
            import tomli as tomllib  # type: ignore[no-redef]
        data = tomllib.loads(content)

        # PEP 621 style
        for dep_str in data.get("project", {}).get("dependencies", []):
            match = re.match(r"^([a-zA-Z0-9_\-\.]+)", dep_str)
            if match:
                name = match.group(1).lower()
                category = _categorize_dependency(name)
                deps.append({
                    "name": name,
                    "version": dep_str[len(name):].strip(),
                    "dep_type": "production",
                    "category": category,
                    "infra_relevant": category in INFRA_RELEVANT_CATEGORIES,
                })

        # Poetry style
        for dep_key, dep_type in [
            ("tool.poetry.dependencies", "production"),
            ("tool.poetry.dev-dependencies", "dev"),
            ("tool.poetry.group.dev.dependencies", "dev"),
        ]:
            section = data
            for key_part in dep_key.split("."):
                section = section.get(key_part, {})
            if isinstance(section, dict):
                for name, version_info in section.items():
                    if name.lower() == "python":
                        continue
                    version = str(version_info) if not isinstance(version_info, dict) else version_info.get("version", "")
                    category = _categorize_dependency(name)
                    deps.append({
                        "name": name.lower(),
                        "version": version,
                        "dep_type": dep_type,
                        "category": category,
                        "infra_relevant": category in INFRA_RELEVANT_CATEGORIES,
                    })
    except Exception:
        pass
    return deps


def _parse_go_mod(content: str) -> List[Dict[str, Any]]:
    """Parse go.mod into dependency list."""
    deps = []
    in_require = False
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("require ("):
            in_require = True
            continue
        if in_require and line == ")":
            in_require = False
            continue
        if in_require or line.startswith("require "):
            # require github.com/gin-gonic/gin v1.9.1
            parts = line.replace("require ", "").strip().split()
            if len(parts) >= 1:
                name = parts[0]
                version = parts[1] if len(parts) > 1 else ""
                category = _categorize_dependency(name.split("/")[-1])
                deps.append({
                    "name": name,
                    "version": version,
                    "dep_type": "production",
                    "category": category,
                    "infra_relevant": category in INFRA_RELEVANT_CATEGORIES,
                })
    return deps


def _parse_generic_deps(content: str, source_file: str) -> List[Dict[str, Any]]:
    """Fallback parser for files we can't parse structurally."""
    return []


DEPENDENCY_PARSERS = {
    "package.json": _parse_package_json,
    "requirements.txt": _parse_requirements_txt,
    "pyproject.toml": _parse_pyproject_toml,
    "Pipfile": _parse_generic_deps,
    "go.mod": _parse_go_mod,
    "pom.xml": _parse_generic_deps,
    "build.gradle": _parse_generic_deps,
    "Cargo.toml": _parse_generic_deps,
    "Gemfile": _parse_generic_deps,
    "composer.json": _parse_generic_deps,
}


def _categorize_dependency(name: str) -> str:
    """Categorize a dependency by name."""
    name_lower = name.lower().strip()
    # Exact match
    if name_lower in DEPENDENCY_CATEGORY_MAP:
        return DEPENDENCY_CATEGORY_MAP[name_lower]
    # Check if any keyword is a substring (for scoped packages like @aws-sdk/client-s3)
    for keyword, category in DEPENDENCY_CATEGORY_MAP.items():
        if keyword in name_lower:
            return category
    return "other"


# ═══════════════════════════════════════════════════════════════════════
#  CORE ANALYSIS FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def _find_repo_root(target_dir: str) -> str:
    """Find the actual root inside extracted ZIP (GitHub ZIPs have a top-level dir)."""
    items = os.listdir(target_dir)
    if len(items) == 1 and os.path.isdir(os.path.join(target_dir, items[0])):
        return os.path.join(target_dir, items[0])
    return target_dir


def detect_languages(repo_root: str) -> Dict[str, Any]:
    """Detect programming languages and frameworks from file extensions and dependencies."""
    lang_counts: Dict[str, int] = {}
    total_source_files = 0

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        for fname in files:
            ext = os.path.splitext(fname)[1].lower()
            lang = EXTENSION_LANGUAGE_MAP.get(ext)
            if lang:
                lang_counts[lang] = lang_counts.get(lang, 0) + 1
                total_source_files += 1

    if not lang_counts:
        return {"primary": "unknown", "secondary": [], "frameworks": []}

    sorted_langs = sorted(lang_counts.items(), key=lambda x: x[1], reverse=True)
    primary = sorted_langs[0][0]
    # Secondary: languages with at least 10% of primary's count
    threshold = sorted_langs[0][1] * 0.1
    secondary = [lang for lang, count in sorted_langs[1:] if count >= threshold]

    return {
        "primary": primary,
        "secondary": secondary,
        "frameworks": [],  # Filled in after dependency parsing
        "file_counts": dict(sorted_langs),
    }


def detect_frameworks(languages: Dict[str, Any], dependencies: List[Dict[str, Any]]) -> List[str]:
    """Detect frameworks from dependency list."""
    frameworks = []
    dep_names = {d["name"].lower() for d in dependencies}

    primary_lang = languages.get("primary", "")
    all_langs = [primary_lang] + languages.get("secondary", [])

    for lang in all_langs:
        indicators = FRAMEWORK_INDICATORS.get(lang, {})
        for framework_name, required_deps in indicators.items():
            if any(dep in dep_names for dep in required_deps):
                if framework_name not in frameworks:
                    frameworks.append(framework_name)

    return frameworks


def parse_all_dependencies(repo_root: str) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
    """Parse all dependency files found in the repo.
    
    Returns:
        Tuple of (dependencies_list, {filename: content} of dep files found)
    """
    all_deps: List[Dict[str, Any]] = []
    dep_file_contents: Dict[str, str] = {}

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel_root = os.path.relpath(root, repo_root)
        if rel_root == ".":
            rel_root = ""

        for fname in files:
            if fname in DEPENDENCY_PARSERS:
                abs_path = os.path.join(root, fname)
                rel_path = os.path.join(rel_root, fname) if rel_root else fname
                rel_path = rel_path.replace("\\", "/")
                try:
                    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                    dep_file_contents[rel_path] = content
                    parser = DEPENDENCY_PARSERS[fname]
                    parsed = parser(content) if fname != "Pipfile" else parser(content, fname)
                    for dep in parsed:
                        dep["source_file"] = rel_path
                    all_deps.extend(parsed)
                except Exception as e:
                    print(f"  ⚠️ Could not parse {rel_path}: {e}")

    return all_deps, dep_file_contents


def detect_infra_signals(repo_root: str) -> Dict[str, Any]:
    """Detect infrastructure-related signals in the repo."""
    signals = {
        "has_dockerfile": False,
        "has_docker_compose": False,
        "has_terraform": False,
        "has_kubernetes": False,
        "has_ci_cd": None,  # Will be set to the CI/CD type if found
        "has_env_file": False,
        "has_serverless": False,
        "has_makefile": False,
        "ci_cd_type": None,
        "env_var_count": 0,
    }

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel_root = os.path.relpath(root, repo_root).replace("\\", "/")
        if rel_root == ".":
            rel_root = ""

        # Check directory-based indicators
        for dir_pattern, indicator_type in INFRA_DIR_INDICATORS.items():
            if dir_pattern in rel_root or dir_pattern in dirs:
                if indicator_type in ("github_actions", "gitlab_ci", "circleci"):
                    signals["has_ci_cd"] = indicator_type
                    signals["ci_cd_type"] = indicator_type
                elif indicator_type in ("kubernetes", "helm"):
                    signals["has_kubernetes"] = True
                elif indicator_type == "terraform":
                    signals["has_terraform"] = True

        for fname in files:
            infra_type = INFRA_FILE_NAMES.get(fname)
            ext = os.path.splitext(fname)[1].lower()
            ext_type = INFRA_FILE_EXTENSIONS.get(ext)

            if infra_type == "dockerfile":
                signals["has_dockerfile"] = True
            elif infra_type == "docker_compose":
                signals["has_docker_compose"] = True
            elif infra_type == "ci_cd":
                signals["has_ci_cd"] = "jenkins"
                signals["ci_cd_type"] = "jenkins"
            elif infra_type == "env_template":
                signals["has_env_file"] = True
                # Count env vars
                try:
                    abs_path = os.path.join(root, fname)
                    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                        env_lines = [l for l in f.readlines() if l.strip() and not l.strip().startswith("#") and "=" in l]
                        signals["env_var_count"] = len(env_lines)
                except Exception:
                    pass
            elif infra_type == "serverless":
                signals["has_serverless"] = True
            elif infra_type == "build_config":
                signals["has_makefile"] = True

            if ext_type == "terraform":
                signals["has_terraform"] = True

            # Check for CI/CD in .github/workflows
            if ".github/workflows" in rel_root and fname.endswith((".yml", ".yaml")):
                signals["has_ci_cd"] = "github_actions"
                signals["ci_cd_type"] = "github_actions"
            if fname == ".gitlab-ci.yml":
                signals["has_ci_cd"] = "gitlab_ci"
                signals["ci_cd_type"] = "gitlab_ci"

    return signals


def extract_infra_files(repo_root: str) -> List[Dict[str, Any]]:
    """Extract content of infrastructure-relevant files (Dockerfile, CI/CD, Terraform, etc.)."""
    infra_files = []

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel_root = os.path.relpath(root, repo_root)
        if rel_root == ".":
            rel_root = ""

        for fname in files:
            file_type = INFRA_FILE_NAMES.get(fname)
            ext = os.path.splitext(fname)[1].lower()
            if not file_type:
                file_type = INFRA_FILE_EXTENSIONS.get(ext)

            # Also capture CI/CD workflow files
            rel_path = os.path.join(rel_root, fname).replace("\\", "/") if rel_root else fname
            if not file_type and ".github/workflows" in rel_path and fname.endswith((".yml", ".yaml")):
                file_type = "ci_cd"

            if not file_type or file_type == "dependency_manifest":
                continue  # Skip — dependency manifests are handled separately

            abs_path = os.path.join(root, fname)
            try:
                with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                content_hash = hashlib.sha256(content.encode()).hexdigest()
                infra_files.append({
                    "file_path": rel_path,
                    "file_type": file_type,
                    "content": content,
                    "content_hash": content_hash,
                })
            except Exception as e:
                print(f"  ⚠️ Could not read infra file {rel_path}: {e}")

    return infra_files


def classify_architecture(repo_root: str, infra_signals: Dict[str, Any]) -> str:
    """Classify the repo architecture type."""
    # Check for monorepo indicators
    dockerfiles = []
    package_jsons = []
    service_dirs = []

    for root, dirs, files in os.walk(repo_root):
        dirs[:] = [d for d in dirs if d not in EXCLUDED_DIRS]
        rel_root = os.path.relpath(root, repo_root).replace("\\", "/")
        depth = len(rel_root.split("/")) if rel_root != "." else 0

        for fname in files:
            if fname == "Dockerfile" and depth <= 2:
                dockerfiles.append(rel_root)
            if fname == "package.json" and depth <= 2:
                package_jsons.append(rel_root)

        # Look for service-like directories at depth 1
        if depth == 0:
            for d in dirs:
                if any(kw in d.lower() for kw in ["service", "api", "app", "server", "worker", "gateway"]):
                    service_dirs.append(d)

    # Multiple Dockerfiles at different paths → microservice/monorepo
    if len(dockerfiles) > 1:
        return "microservice"
    if len(package_jsons) > 2 and len(service_dirs) > 1:
        return "monorepo"

    # Check for serverless
    if infra_signals.get("has_serverless"):
        return "serverless"

    # Check for static site (only HTML/CSS/JS, no backend framework)
    return "monolith"  # Default


def generate_directory_summary(repo_root: str, total_files: int) -> str:
    """Generate a human-readable directory structure summary."""
    lines = []
    top_dirs = {}

    for item in sorted(os.listdir(repo_root)):
        abs_path = os.path.join(repo_root, item)
        if item in EXCLUDED_DIRS or item.startswith("."):
            continue

        if os.path.isdir(abs_path):
            # Count files in this dir (recursively, excluding EXCLUDED_DIRS)
            file_count = 0
            for r, ds, fs in os.walk(abs_path):
                ds[:] = [d for d in ds if d not in EXCLUDED_DIRS]
                file_count += len(fs)
            top_dirs[item] = file_count
            lines.append(f"  {item}/ — {file_count} files")
        elif os.path.isfile(abs_path):
            lines.append(f"  {item}")

    header = f"Directory Structure ({total_files} total files):"
    return header + "\n" + "\n".join(lines) if lines else header


def detect_runtime_version(
    languages: Dict[str, Any],
    dep_file_contents: Dict[str, str],
    infra_files: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Detect runtime version from Dockerfile, package.json engines, etc."""
    tech_stack: Dict[str, Any] = {
        "runtime": None,
        "runtime_version": None,
        "package_manager": None,
        "containerized": False,
    }

    primary = languages.get("primary", "")

    # Detect package manager
    for dep_path in dep_file_contents:
        basename = os.path.basename(dep_path)
        if basename == "package.json":
            tech_stack["package_manager"] = "npm"
            # Check for yarn.lock or pnpm-lock
        elif basename == "requirements.txt":
            tech_stack["package_manager"] = "pip"
        elif basename == "pyproject.toml":
            tech_stack["package_manager"] = "pip"
        elif basename == "Pipfile":
            tech_stack["package_manager"] = "pipenv"
        elif basename == "go.mod":
            tech_stack["package_manager"] = "go modules"
        elif basename == "pom.xml":
            tech_stack["package_manager"] = "maven"
        elif basename == "build.gradle":
            tech_stack["package_manager"] = "gradle"
        elif basename == "Cargo.toml":
            tech_stack["package_manager"] = "cargo"

    # Detect runtime version from Dockerfile
    for f in infra_files:
        if f["file_type"] == "dockerfile":
            tech_stack["containerized"] = True
            # Parse FROM line
            for line in f["content"].splitlines():
                line = line.strip()
                if line.upper().startswith("FROM "):
                    base_image = line[5:].strip().split(" ")[0]
                    tech_stack["runtime"] = base_image
                    # Extract version: python:3.11-slim → 3.11
                    if ":" in base_image:
                        version_part = base_image.split(":")[1].split("-")[0]
                        tech_stack["runtime_version"] = version_part
                    break

    if not tech_stack["runtime"]:
        tech_stack["runtime"] = primary

    return tech_stack


# ═══════════════════════════════════════════════════════════════════════
#  MAIN ANALYSIS ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════

def analyze_repository(
    repo_dir: str,
    repo_id: str,
    repo_name: str,
    scm_provider: str,
    user_id: str,
    project_id: str = "",
    default_branch: str = "main",
) -> Dict[str, Any]:
    """
    Run the full deterministic analysis pipeline on an extracted repo directory.

    Args:
        repo_dir: Path to the extracted repo directory.
        repo_id: SCM repo ID (from user_scm_data).
        repo_name: Full repo name (e.g., "org/my-app").
        scm_provider: "github", "gitlab", or "bitbucket".
        user_id: InfraX user ID who owns this repo.
        project_id: Optional InfraX project ID if linked.
        default_branch: Branch that was analyzed.

    Returns:
        Complete analysis dict ready for MongoDB insertion.
    """
    print(f"\n🔬 [ANALYZER] Analyzing repository: {repo_name}")

    repo_root = _find_repo_root(repo_dir)

    # Count total files
    total_files = 0
    for r, ds, fs in os.walk(repo_root):
        ds[:] = [d for d in ds if d not in EXCLUDED_DIRS]
        total_files += len(fs)

    # 1. Detect languages
    languages = detect_languages(repo_root)
    print(f"  📝 Languages: primary={languages['primary']}, secondary={languages.get('secondary', [])}")

    # 2. Parse dependencies
    dependencies, dep_file_contents = parse_all_dependencies(repo_root)
    print(f"  📦 Dependencies: {len(dependencies)} total")

    # 3. Detect frameworks (requires dependencies)
    frameworks = detect_frameworks(languages, dependencies)
    languages["frameworks"] = frameworks
    print(f"  🏗️  Frameworks: {frameworks}")

    # 4. Detect infra signals
    infra_signals = detect_infra_signals(repo_root)
    print(f"  🔧 Infra signals: dockerfile={infra_signals['has_dockerfile']}, "
          f"compose={infra_signals['has_docker_compose']}, "
          f"terraform={infra_signals['has_terraform']}, "
          f"ci_cd={infra_signals['has_ci_cd']}")

    # 5. Extract infra file contents
    infra_files = extract_infra_files(repo_root)
    print(f"  📄 Infra files: {len(infra_files)} files extracted")

    # 6. Classify architecture
    architecture_type = classify_architecture(repo_root, infra_signals)
    print(f"  🏛️  Architecture: {architecture_type}")

    # 7. Generate directory summary
    directory_summary = generate_directory_summary(repo_root, total_files)

    # 8. Detect runtime/tech stack
    tech_stack = detect_runtime_version(languages, dep_file_contents, infra_files)
    print(f"  ⚙️  Tech stack: {tech_stack}")

    # Count infra-relevant deps
    infra_dep_count = sum(1 for d in dependencies if d.get("infra_relevant"))
    print(f"  🎯 Infra-relevant deps: {infra_dep_count}")

    analysis = {
        "repo_id": str(repo_id),
        "project_id": project_id,
        "repo_name": repo_name,
        "scm_provider": scm_provider,
        "default_branch": default_branch,
        "user_id": user_id,
        "languages": languages,
        "tech_stack": tech_stack,
        "architecture_type": architecture_type,
        "infra_signals": infra_signals,
        "directory_summary": directory_summary,
        "total_files": total_files,
        "dependencies": dependencies,
        "dep_file_contents": dep_file_contents,
        "infra_files": infra_files,
        "analysis_version": 1,
        "status": "ready",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    print(f"  ✅ Analysis complete: {total_files} files, {len(dependencies)} deps, "
          f"{len(infra_files)} infra files\n")

    return analysis
